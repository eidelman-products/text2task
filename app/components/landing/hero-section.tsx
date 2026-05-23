"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const workflowSteps = [
  {
    number: "1",
    title: "Paste or upload a client request",
    text: "Add a message, email, note, or screenshot from your client.",
  },
  {
    number: "2",
    title: "AI extracts the work",
    text: "Text2Task finds the project, tasks, budget, deadline, and client details.",
  },
  {
    number: "3",
    title: "Review before saving",
    text: "Edit the draft, fix details, and save only when everything looks right.",
  },
  {
    number: "4",
    title: "Manage it in your workspace",
    text: "Track tasks, urgent work, deadlines, resources, and recent activity.",
  },
];

const freePlan = [
  "30 total AI extracts",
  "Text + image extraction",
  "Review before saving",
  "Basic workspace",
];

const proPlan = [
  "Unlimited AI extracts",
  "Unlimited saved tasks",
  "CSV export",
  "Dashboard analytics",
  "Future Pro features included",
];

export default function HeroSection() {
  const [lightboxImage, setLightboxImage] = useState<
    | {
        title: string;
        image: string;
        alt: string;
        ctaText: string;
        ctaHref: string;
      }
    | null
  >(null);

  useEffect(() => {
    if (!lightboxImage) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLightboxImage(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxImage]);

  const openLightbox = (payload: {
    title: string;
    image: string;
    alt: string;
    ctaText: string;
    ctaHref: string;
  }) => {
    setLightboxImage(payload);
  };

  const closeLightbox = () => setLightboxImage(null);

  return (
    <div className="t2t-page">
      <style>{styles}</style>

      <header className="t2t-header">
        <Link href="/" className="t2t-logo" aria-label="Text2Task home">
          <Image
            src="/text2task-logo.png"
            alt="Text2Task"
            width={176}
            height={48}
            priority
          />
        </Link>

        <nav className="t2t-nav">
          <a href="#how-it-works">How it works</a>
          <a href="#demo">Demo</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <Link href="/login">Log in</Link>
        </nav>

        <Link href="/signup" className="t2t-nav-cta">
          Try Text2Task
        </Link>
      </header>

      <main className="t2t-main">
        <section className="t2t-hero">
          <div className="t2t-hero-copy">
            <h1>
              Turn messy client
              <br />
              requests into
              <br />
              <span>ready-to-work projects.</span>
            </h1>

            <p>
              Text2Task turns messy client requests into clean projects with
              tasks, budgets, deadlines, and client details — in seconds.
            </p>

            <div className="t2t-actions">
              <Link href="/signup" className="t2t-primary">
                Start for free
              </Link>
              <a href="#demo" className="t2t-secondary">
                Watch demo
              </a>
            </div>
          </div>
        </section>

        <section className="t2t-transform-section">
          <div className="t2t-transform-heading">
            <div className="t2t-section-kicker">Request to project</div>
            <h2>One messy client request becomes a ready-to-work project.</h2>
          </div>

          <div className="t2t-transform-meta">
            <div className="t2t-demo-preview-label">Example preview</div>
            <p className="t2t-transform-note">
              Sample preview. Try it with your own client message.
            </p>
            <Link href="/signup" className="t2t-transform-cta">
              Try with your own message
            </Link>
          </div>

          <div className="t2t-transform-grid">
            <button
              type="button"
              className="t2t-transform-card-button"
              onClick={() =>
                openLightbox({
                  title: "Messy client request preview",
                  image: "/landing/text2task-whatsapp-message.png",
                  alt: "WhatsApp client request",
                  ctaText: "Try with your own message",
                  ctaHref: "/signup",
                })
              }
              aria-label="Open messy client request preview"
            >
              <div className="t2t-transform-card">
                <div className="t2t-card-label green">
                  Step 1: Messy client request
                </div>
                <div className="t2t-transform-preview-pill">Click to enlarge</div>
                <div className="t2t-transform-image whatsapp">
                  <Image
                    src="/landing/text2task-whatsapp-message.png"
                    alt="WhatsApp client request"
                    width={760}
                    height={760}
                    priority
                  />
                </div>
              </div>
            </button>

            <div className="t2t-arrow-wrap">
              <div className="t2t-arrow-circle">
                <svg
                  viewBox="0 0 120 120"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M24 60H92"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M68 36L92 60L68 84"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p>AI extracts the work</p>
            </div>

            <button
              type="button"
              className="t2t-transform-card-button"
              onClick={() =>
                openLightbox({
                  title: "Ready-to-work project preview",
                  image: "/landing/text2task-ai-project-preview.png",
                  alt: "Text2Task extracted project preview",
                  ctaText: "Try Text2Task free",
                  ctaHref: "/signup",
                })
              }
              aria-label="Open ready-to-work project preview"
            >
              <div className="t2t-transform-card result">
                <div className="t2t-card-label purple">
                  Step 2: Ready-to-work project
                </div>
                <div className="t2t-transform-preview-pill">Click to enlarge</div>
                <div className="t2t-transform-image preview">
                  <Image
                    src="/landing/text2task-ai-project-preview.png"
                    alt="Text2Task extracted project preview"
                    width={1600}
                    height={720}
                    priority
                  />
                </div>
              </div>
            </button>
          </div>
        </section>

        <section id="demo" className="t2t-demo-section">
          <div className="t2t-section-kicker">See it in action</div>
          <h2>From request to ready-to-work</h2>

          <div className="t2t-demo-grid">
            <div className="t2t-video-card">
              <div className="t2t-video-top">
                <span />
                <span />
                <span />
                <strong>Text2Task demo</strong>
              </div>

              <video
                src="/text2task-demo.mp4.mp4"
                controls
                playsInline
                preload="metadata"
                className="t2t-video"
              >
                Your browser does not support the video tag.
              </video>
            </div>

            <div id="how-it-works" className="t2t-steps">
              <Step
                number="1"
                title="Paste a request"
                text="Add a message, email, or screenshot."
              />
              <Step
                number="2"
                title="AI extracts the work"
                text="It finds tasks, budget, deadline, and client details."
              />
              <Step
                number="3"
                title="Review & save"
                text="Check everything and save to your workspace."
              />
            </div>
          </div>
        </section>

        <section id="features" className="t2t-workflow">
          <div className="t2t-section-kicker">How Text2Task works</div>
          <h2>From client request to organized work</h2>

          <div className="t2t-workflow-track" aria-label="Text2Task workflow">
            <div className="t2t-workflow-line" aria-hidden="true" />

            {workflowSteps.map((step) => (
              <div className="t2t-workflow-step" key={step.title}>
                <div className="t2t-workflow-number">{step.number}</div>
                <div className="t2t-workflow-content">
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="t2t-workspace">
          <div className="t2t-section-kicker">Workspace preview</div>

          <div className="t2t-workspace-grid">
            <ProductCard
              title="Task CRM"
              text="Manage all your client projects and tasks."
              image="/landing/text2task-task-crm.png"
              alt="Text2Task task CRM"
              onOpen={() =>
                openLightbox({
                  title: "Task CRM preview",
                  image: "/landing/text2task-task-crm.png",
                  alt: "Text2Task task CRM",
                  ctaText: "Try Text2Task free",
                  ctaHref: "/signup",
                })
              }
              ariaLabel="Open Task CRM preview"
            />

            <ProductCard
              title="Urgent Tasks Board"
              text="See what needs attention now."
              image="/landing/text2task-urgent-board.png"
              alt="Text2Task urgent tasks board"
              onOpen={() =>
                openLightbox({
                  title: "Urgent Tasks Board preview",
                  image: "/landing/text2task-urgent-board.png",
                  alt: "Text2Task urgent tasks board",
                  ctaText: "Try Text2Task free",
                  ctaHref: "/signup",
                })
              }
              ariaLabel="Open Urgent Tasks Board preview"
            />
          </div>
        </section>

        {lightboxImage ? (
          <div
            className="t2t-lightbox-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={`${lightboxImage.title} preview`}
            onClick={closeLightbox}
          >
            <div
              className="t2t-lightbox-panel"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="t2t-lightbox-close"
                onClick={closeLightbox}
                aria-label="Close preview"
              >
                ×
              </button>

              <div className="t2t-lightbox-copy">
                <div className="t2t-lightbox-kicker">Preview</div>
                <h3>{lightboxImage.title}</h3>
              </div>

              <div className="t2t-lightbox-image">
                <Image
                  src={lightboxImage.image}
                  alt={lightboxImage.alt}
                  width={1200}
                  height={720}
                  priority
                />
              </div>

              <Link href={lightboxImage.ctaHref} className="t2t-lightbox-cta">
                {lightboxImage.ctaText}
              </Link>
            </div>
          </div>
        ) : null}

        <section id="pricing" className="t2t-pricing">
          <div className="t2t-section-kicker">Simple pricing</div>

          <div className="t2t-pricing-grid">
            <PricingCard
              title="Free"
              price="$0"
              suffix="/ month"
              items={freePlan}
              button="Get started free"
            />

            <PricingCard
              title="Pro"
              price="$12.90"
              suffix="/ month"
              items={proPlan}
              button="Upgrade to Pro"
              popular
            />
          </div>
        </section>

        <section className="t2t-bottom-cta">
          <div>
            <h2>Stop copying. Start organizing.</h2>
            <p>Try Text2Task with your next real client request.</p>
          </div>

          <Link href="/signup">Get started free</Link>
        </section>
      </main>
    </div>
  );
}

function Step({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="t2t-step">
      <div className="t2t-step-icon">{number}</div>
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
    </div>
  );
}

function ProductCard({
  title,
  text,
  image,
  alt,
  onOpen,
  ariaLabel,
}: {
  title: string;
  text: string;
  image: string;
  alt: string;
  onOpen?: () => void;
  ariaLabel?: string;
}) {
  const cardContent = (
    <>
      <div className="t2t-product-head">
        <div>
          <h3>{title}</h3>
          <p>{text}</p>
        </div>
        {onOpen ? (
          <div className="t2t-product-preview-pill">View preview</div>
        ) : null}
      </div>

      <div className="t2t-product-image">
        <Image src={image} alt={alt} width={1000} height={560} />
      </div>
    </>
  );

  if (onOpen) {
    return (
      <button
        type="button"
        className="t2t-product-card t2t-product-card-button"
        onClick={onOpen}
        aria-label={ariaLabel}
      >
        {cardContent}
      </button>
    );
  }

  return <div className="t2t-product-card">{cardContent}</div>;
}

function PricingCard({
  title,
  price,
  suffix,
  items,
  button,
  popular = false,
}: {
  title: string;
  price: string;
  suffix: string;
  items: string[];
  button: string;
  popular?: boolean;
}) {
  return (
    <div className={popular ? "t2t-price-card popular" : "t2t-price-card"}>
      {popular ? <div className="t2t-popular">Most popular</div> : null}

      <h3>{title}</h3>

      <div className="t2t-price">
        <strong>{price}</strong>
        <span>{suffix}</span>
      </div>

      <ul>
        {items.map((item) => (
          <li key={item}>✓ {item}</li>
        ))}
      </ul>

      <Link href="/signup">{button}</Link>
    </div>
  );
}

const styles = `
  .t2t-page {
    min-height: 100vh;
    background:
      radial-gradient(circle at 12% 4%, rgba(99, 102, 241, 0.15), transparent 31%),
      radial-gradient(circle at 84% 12%, rgba(168, 85, 247, 0.13), transparent 33%),
      radial-gradient(circle at 50% 58%, rgba(14, 165, 233, 0.055), transparent 38%),
      linear-gradient(180deg, #ffffff 0%, #f8fbff 48%, #ffffff 100%);
    color: #0f172a;
  }

  .t2t-page * {
    box-sizing: border-box;
  }

  .t2t-header {
    width: min(1180px, calc(100% - 40px));
    margin: 0 auto;
    padding: 18px 0 6px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }

  .t2t-logo {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
  }

  .t2t-logo img {
    width: 154px;
    height: auto;
    display: block;
    object-fit: contain;
    object-position: left center;
  }

  .t2t-nav {
    display: flex;
    align-items: center;
    gap: 25px;
    font-size: 13px;
    font-weight: 800;
  }

  .t2t-nav a {
    color: #0f172a;
    text-decoration: none;
    transition: color 160ms ease;
  }

  .t2t-nav a:hover {
    color: #4f46e5;
  }

  .t2t-nav-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 42px;
    padding: 0 19px;
    border-radius: 15px;
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    color: white;
    text-decoration: none;
    font-size: 13px;
    font-weight: 950;
    box-shadow: 0 16px 36px rgba(79, 70, 229, 0.24);
    transition: transform 160ms ease, box-shadow 160ms ease;
  }

  .t2t-nav-cta:hover {
    transform: translateY(-1px);
    box-shadow: 0 20px 42px rgba(79, 70, 229, 0.28);
  }

  .t2t-main {
    width: min(1180px, calc(100% - 40px));
    margin: 0 auto;
    padding-bottom: 28px;
  }

  .t2t-hero {
    display: flex;
    justify-content: center;
    padding: 62px 0 42px;
    text-align: center;
  }

  .t2t-hero-copy {
    max-width: 820px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .t2t-hero h1 {
    margin: 18px 0 0;
    font-size: clamp(51px, 6vw, 81px);
    line-height: 1.03;
    letter-spacing: -0.026em;
    font-weight: 800;
  }

  .t2t-hero h1 span {
    color: #4f46e5;
    white-space: nowrap;
  }

  .t2t-hero-copy p {
    margin: 18px auto 0;
    font-size: clamp(18px, 2vw, 22px);
    line-height: 1.6;
    color: #475569;
    max-width: 720px;
    font-weight: 560;
  }

  .t2t-actions {
    margin-top: 26px;
    display: flex;
    justify-content: center;
    gap: 14px;
    flex-wrap: wrap;
  }

  .t2t-primary,
  .t2t-secondary {
    height: 44px;
    padding: 0 22px;
    border-radius: 15px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    font-size: 14px;
    font-weight: 950;
    transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
  }

  .t2t-primary {
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    color: white;
    box-shadow: 0 16px 36px rgba(79, 70, 229, 0.22);
  }

  .t2t-secondary {
    background: rgba(255,255,255,0.88);
    color: #0f172a;
    border: 1px solid #dbe4f0;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.04);
  }

  .t2t-primary:hover,
  .t2t-secondary:hover {
    transform: translateY(-1px);
  }

  .t2t-transform-section {
    padding: 28px 0 44px;
  }

  .t2t-transform-heading {
    text-align: center;
    margin-bottom: 24px;
  }

  .t2t-transform-heading h2 {
    margin: 12px auto 0;
    max-width: 720px;
    font-size: 34px;
    line-height: 1.08;
    letter-spacing: -0.055em;
    font-weight: 950;
  }

  .t2t-transform-meta {
    display: grid;
    justify-items: center;
    gap: 12px;
    margin: 0 auto 24px;
    max-width: 720px;
  }

  .t2t-demo-preview-label {
    color: #6b7280;
    font-size: 12px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    font-weight: 900;
  }

  .t2t-transform-note {
    margin: 0;
    max-width: 640px;
    color: #475569;
    font-size: 14px;
    line-height: 1.65;
  }

  .t2t-transform-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 20px;
    height: 42px;
    border-radius: 14px;
    background: rgba(79, 70, 229, 0.08);
    color: #4f46e5;
    text-decoration: none;
    font-size: 14px;
    font-weight: 900;
    border: 1px solid rgba(79, 70, 229, 0.16);
    transition: transform 160ms ease, background 160ms ease;
  }

  .t2t-transform-cta:hover {
    transform: translateY(-1px);
    background: rgba(79, 70, 229, 0.12);
  }

  .t2t-transform-card-button {
    border: none;
    background: transparent;
    width: 100%;
    padding: 0;
    text-align: left;
    cursor: pointer;
  }

  .t2t-transform-card-button:focus-visible {
    outline: 3px solid rgba(79, 70, 229, 0.36);
    outline-offset: 4px;
  }

  .t2t-transform-preview-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 10px 0 0;
    padding: 6px 12px;
    border-radius: 999px;
    background: rgba(79, 70, 229, 0.08);
    color: #4f46e5;
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .t2t-transform-card-link {
    display: block;
    color: inherit;
    text-decoration: none;
  }

  .t2t-transform-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 104px minmax(0, 1.2fr);
    gap: 22px;
    align-items: center;
  }

  .t2t-transform-card {
    border: 1px solid rgba(226, 232, 240, 0.96);
    background: rgba(255, 255, 255, 0.92);
    border-radius: 28px;
    padding: 16px;
    box-shadow:
      0 24px 65px rgba(15, 23, 42, 0.10),
      inset 0 1px 0 rgba(255,255,255,0.9);
    backdrop-filter: blur(16px);
    transition: transform 160ms ease, box-shadow 160ms ease;
  }

  .t2t-transform-card:hover {
    transform: translateY(-2px);
    box-shadow:
      0 30px 76px rgba(15, 23, 42, 0.12),
      inset 0 1px 0 rgba(255,255,255,0.9);
  }

  .t2t-transform-card.result {
    box-shadow:
      0 28px 78px rgba(79, 70, 229, 0.15),
      inset 0 1px 0 rgba(255,255,255,0.9);
  }

  .t2t-transform-card.result:hover {
    box-shadow:
      0 34px 86px rgba(79, 70, 229, 0.17),
      inset 0 1px 0 rgba(255,255,255,0.9);
  }

  .t2t-card-label {
    display: inline-flex;
    align-items: center;
    min-height: 27px;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 11px;
    line-height: 1.2;
    font-weight: 950;
    text-transform: uppercase;
    letter-spacing: 0.13em;
    margin-bottom: 10px;
  }

  .t2t-card-label.green {
    background: #dcfce7;
    color: #047857;
  }

  .t2t-card-label.purple {
    background: #eef2ff;
    color: #4f46e5;
  }

  .t2t-transform-image {
    overflow: hidden;
    border-radius: 20px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .t2t-transform-image img {
    display: block;
    width: 100%;
    object-fit: contain;
    object-position: center;
    background: #f8fafc;
  }

  .t2t-transform-image.whatsapp img {
    height: 340px;
  }

  .t2t-transform-image.preview img {
    height: 340px;
  }

  .t2t-arrow-wrap {
    display: grid;
    justify-items: center;
    gap: 12px;
    color: #4f46e5;
  }

  .t2t-arrow-circle {
    width: 74px;
    height: 74px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    background:
      radial-gradient(circle at top left, #ffffff, #eef2ff);
    border: 1px solid #c7d2fe;
    box-shadow: 0 18px 42px rgba(79, 70, 229, 0.16);
  }

  .t2t-arrow-circle svg {
    width: 44px;
    height: 44px;
  }

  .t2t-arrow-wrap p {
    margin: 0;
    max-width: 120px;
    text-align: center;
    color: #475569;
    font-size: 12.5px;
    line-height: 1.35;
    font-weight: 950;
  }

  .t2t-demo-section,
  .t2t-workflow,
  .t2t-workspace,
  .t2t-pricing {
    padding: 30px 0;
  }

  .t2t-section-kicker {
    text-align: center;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.19em;
    font-size: 12px;
    font-weight: 950;
  }

  .t2t-demo-section h2 {
    margin: 12px 0 24px;
    text-align: center;
    font-size: 29px;
    line-height: 1.12;
    letter-spacing: -0.048em;
    font-weight: 950;
  }

  .t2t-demo-grid {
    max-width: 820px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1.22fr 0.78fr;
    gap: 28px;
    align-items: center;
  }

  .t2t-video-card {
    overflow: hidden;
    border-radius: 24px;
    background: #020617;
    padding: 10px;
    box-shadow: 0 24px 66px rgba(15, 23, 42, 0.17);
  }

  .t2t-video-top {
    height: 31px;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0 8px;
  }

  .t2t-video-top span {
    width: 9px;
    height: 9px;
    border-radius: 999px;
    background: #64748b;
  }

  .t2t-video-top span:nth-child(1) {
    background: #fb7185;
  }

  .t2t-video-top span:nth-child(2) {
    background: #fbbf24;
  }

  .t2t-video-top span:nth-child(3) {
    background: #34d399;
  }

  .t2t-video-top strong {
    margin-left: 8px;
    color: #94a3b8;
    font-size: 11px;
  }

  .t2t-video {
    display: block;
    width: 100%;
    max-height: 240px;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 17px;
    background: #020617;
  }

  .t2t-steps {
    display: grid;
    gap: 17px;
  }

  .t2t-step {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .t2t-step-icon {
    width: 40px;
    height: 40px;
    flex: 0 0 auto;
    border-radius: 16px;
    background: #eef2ff;
    color: #4f46e5;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 950;
    box-shadow: 0 10px 24px rgba(79, 70, 229, 0.08);
  }

  .t2t-step h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 950;
    letter-spacing: -0.02em;
  }

  .t2t-step p {
    margin: 5px 0 0;
    color: #64748b;
    font-size: 13px;
    line-height: 1.55;
  }

  .t2t-workflow {
    position: relative;
  }

  .t2t-workflow h2 {
    margin: 12px auto 0;
    max-width: 680px;
    text-align: center;
    font-size: 32px;
    line-height: 1.1;
    letter-spacing: -0.045em;
    font-weight: 950;
  }

  .t2t-workflow-track {
    position: relative;
    max-width: 1040px;
    margin: 34px auto 0;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0;
    isolation: isolate;
  }

  .t2t-workflow-line {
    position: absolute;
    top: 25px;
    left: calc(12.5% + 24px);
    right: calc(12.5% + 24px);
    height: 2px;
    background: linear-gradient(
      90deg,
      rgba(79, 70, 229, 0.14),
      rgba(79, 70, 229, 0.38),
      rgba(124, 58, 237, 0.38),
      rgba(124, 58, 237, 0.14)
    );
    z-index: 0;
  }

  .t2t-workflow-line::before,
  .t2t-workflow-line::after {
    content: "";
    position: absolute;
    top: 50%;
    width: 7px;
    height: 7px;
    border-top: 2px solid rgba(79, 70, 229, 0.34);
    border-right: 2px solid rgba(79, 70, 229, 0.34);
    transform: translateY(-50%) rotate(45deg);
  }

  .t2t-workflow-line::before {
    left: 31%;
  }

  .t2t-workflow-line::after {
    right: 31%;
  }

  .t2t-workflow-step {
    position: relative;
    z-index: 1;
    min-width: 0;
    padding: 0 16px;
    text-align: center;
  }

  .t2t-workflow-number {
    width: 52px;
    height: 52px;
    margin: 0 auto;
    border-radius: 999px;
    background:
      radial-gradient(circle at 30% 20%, #ffffff 0%, #ffffff 28%, transparent 40%),
      linear-gradient(135deg, #eef2ff, #f5f3ff);
    border: 1px solid rgba(199, 210, 254, 0.92);
    color: #4f46e5;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: 950;
    box-shadow:
      0 14px 30px rgba(79, 70, 229, 0.12),
      0 0 0 8px rgba(255, 255, 255, 0.86),
      inset 0 1px 0 rgba(255,255,255,0.95);
  }

  .t2t-workflow-content {
    margin-top: 18px;
  }

  .t2t-workflow-content h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 950;
    line-height: 1.2;
    letter-spacing: -0.032em;
  }

  .t2t-workflow-content p {
    margin: 9px auto 0;
    max-width: 215px;
    color: #64748b;
    font-size: 13px;
    line-height: 1.58;
  }

  .t2t-workspace-grid {
    margin-top: 22px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 22px;
  }

  .t2t-product-card {
    background:
      linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.92));
    border: 1px solid rgba(226, 232, 240, 0.95);
    border-radius: 26px;
    padding: 16px;
    box-shadow:
      0 22px 62px rgba(15, 23, 42, 0.075),
      inset 0 1px 0 rgba(255,255,255,0.94);
    transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
  }

  .t2t-product-card:hover {
    transform: translateY(-3px);
    border-color: #c7d2fe;
    box-shadow:
      0 32px 78px rgba(79, 70, 229, 0.13),
      inset 0 1px 0 rgba(255,255,255,0.96);
  }

  .t2t-product-head h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 950;
    letter-spacing: -0.03em;
  }

  .t2t-product-head p {
    margin: 4px 0 12px;
    color: #64748b;
    font-size: 13px;
  }

  .t2t-product-image {
    overflow: hidden;
    border-radius: 18px;
    border: 1px solid rgba(203, 213, 225, 0.9);
    background: #f8fafc;
    box-shadow:
      0 18px 42px rgba(15, 23, 42, 0.075),
      inset 0 1px 0 rgba(255,255,255,0.9);
  }

  .t2t-product-image img {
    display: block;
    width: 100%;
    height: 238px;
    object-fit: contain;
    object-position: center;
    background: #f8fafc;
  }

  .t2t-product-card-button {
    background: transparent;
    border: none;
    width: 100%;
    text-align: left;
    cursor: pointer;
    padding: 0;
  }

  .t2t-product-card-button:focus-visible {
    outline: 3px solid rgba(79, 70, 229, 0.35);
    outline-offset: 4px;
  }

  .t2t-product-preview-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(99, 102, 241, 0.10);
    color: #4f46e5;
    font-size: 11px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .t2t-lightbox-overlay {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(15, 23, 42, 0.72);
    padding: 22px;
    z-index: 9999;
  }

  .t2t-lightbox-panel {
    position: relative;
    width: min(100%, 1040px);
    max-height: min(100%, 96vh);
    padding: 28px;
    background: rgba(255, 255, 255, 0.98);
    border-radius: 28px;
    box-shadow: 0 34px 90px rgba(15, 23, 42, 0.18);
    overflow: auto;
  }

  .t2t-lightbox-close {
    position: absolute;
    top: 18px;
    right: 18px;
    width: 38px;
    height: 38px;
    border: none;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.08);
    color: #0f172a;
    font-size: 22px;
    cursor: pointer;
  }

  .t2t-lightbox-close:hover {
    background: rgba(15, 23, 42, 0.12);
  }

  .t2t-lightbox-copy {
    margin-bottom: 18px;
  }

  .t2t-lightbox-kicker {
    display: inline-flex;
    margin-bottom: 10px;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    font-size: 12px;
    font-weight: 900;
  }

  .t2t-lightbox-panel h3 {
    margin: 0;
    font-size: 28px;
    line-height: 1.08;
    color: #102045;
  }

  .t2t-lightbox-image {
    margin: 18px 0 22px;
    border-radius: 22px;
    overflow: hidden;
    border: 1px solid rgba(226, 232, 240, 0.95);
    background: #f8fafc;
  }

  .t2t-lightbox-image img {
    width: 100%;
    height: auto;
    object-fit: contain;
    display: block;
  }

  .t2t-lightbox-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 44px;
    padding: 0 22px;
    border-radius: 14px;
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    color: white;
    text-decoration: none;
    font-size: 14px;
    font-weight: 900;
  }

  @media (max-width: 760px) {
    .t2t-lightbox-panel {
      width: 100%;
      max-height: 100%;
      padding: 20px;
      border-radius: 20px;
    }

    .t2t-lightbox-panel h3 {
      font-size: 24px;
    }

    .t2t-lightbox-image {
      margin: 16px 0 18px;
    }
  }

  .t2t-pricing-grid {
    max-width: 740px;
    margin: 22px auto 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 22px;
  }

  .t2t-price-card {
    position: relative;
    background:
      linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.92));
    border: 1px solid rgba(226, 232, 240, 0.96);
    border-radius: 26px;
    padding: 26px;
    box-shadow:
      0 20px 58px rgba(15, 23, 42, 0.075),
      inset 0 1px 0 rgba(255,255,255,0.94);
    transition: transform 170ms ease, box-shadow 170ms ease, border-color 170ms ease, background 170ms ease;
  }

  .t2t-price-card:hover {
    transform: translateY(-4px);
    border-color: #c7d2fe;
    background:
      linear-gradient(180deg, #ffffff, #f8f7ff);
    box-shadow:
      0 34px 82px rgba(79, 70, 229, 0.13),
      inset 0 1px 0 rgba(255,255,255,0.96);
  }

  .t2t-price-card.popular {
    border-color: #b8a6ff;
    background:
      radial-gradient(circle at 85% 0%, rgba(124, 58, 237, 0.12), transparent 34%),
      linear-gradient(180deg, rgba(255,255,255,0.99), rgba(245,243,255,0.9));
    box-shadow:
      0 28px 74px rgba(79, 70, 229, 0.14),
      0 0 0 1px rgba(124, 58, 237, 0.06),
      inset 0 1px 0 rgba(255,255,255,0.96);
  }

  .t2t-price-card.popular:hover {
    border-color: #9b8cff;
    box-shadow:
      0 38px 92px rgba(79, 70, 229, 0.2),
      0 0 0 1px rgba(124, 58, 237, 0.12),
      inset 0 1px 0 rgba(255,255,255,0.98);
  }

  .t2t-popular {
    position: absolute;
    top: -14px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    color: white;
    border-radius: 999px;
    padding: 7px 18px;
    font-size: 11px;
    font-weight: 950;
    box-shadow: 0 14px 30px rgba(79, 70, 229, 0.24);
  }

  .t2t-price-card h3 {
    margin: 0;
    font-size: 22px;
    font-weight: 950;
  }

  .t2t-price {
    margin-top: 14px;
    display: flex;
    align-items: flex-end;
    gap: 6px;
  }

  .t2t-price strong {
    font-size: 42px;
    line-height: 1;
    letter-spacing: -0.05em;
  }

  .t2t-price span {
    color: #64748b;
    font-size: 13px;
    font-weight: 800;
    padding-bottom: 4px;
  }

  .t2t-price-card ul {
    list-style: none;
    margin: 22px 0 0;
    padding: 0;
    display: grid;
    gap: 11px;
  }

  .t2t-price-card li {
    color: #334155;
    font-size: 13px;
    font-weight: 750;
  }

  .t2t-price-card a {
    margin-top: 24px;
    width: 100%;
    height: 44px;
    border-radius: 15px;
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    color: white;
    text-decoration: none;
    font-size: 13px;
    font-weight: 950;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 14px 34px rgba(79, 70, 229, 0.18);
    transition: transform 160ms ease, box-shadow 160ms ease;
  }

  .t2t-price-card a:hover {
    transform: translateY(-1px);
    box-shadow: 0 20px 44px rgba(79, 70, 229, 0.28);
  }

  .t2t-bottom-cta {
    margin: 26px auto 0;
    max-width: 930px;
    border-radius: 26px;
    background: linear-gradient(135deg, #f1efff, #eef2ff);
    border: 1px solid #e0e7ff;
    padding: 24px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    box-shadow: 0 18px 54px rgba(79, 70, 229, 0.08);
  }

  .t2t-bottom-cta h2 {
    margin: 0;
    font-size: 28px;
    line-height: 1.15;
    letter-spacing: -0.045em;
    font-weight: 950;
  }

  .t2t-bottom-cta p {
    margin: 6px 0 0;
    color: #64748b;
    font-size: 14px;
  }

  .t2t-bottom-cta a {
    height: 44px;
    min-width: 170px;
    border-radius: 15px;
    background: linear-gradient(135deg, #4f46e5, #7c3aed);
    color: white;
    text-decoration: none;
    font-weight: 950;
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 14px 34px rgba(79, 70, 229, 0.18);
  }

  @media (max-width: 980px) {
    .t2t-nav {
      display: none;
    }

    .t2t-hero {
      padding-top: 34px;
    }

    .t2t-hero-copy {
      max-width: 680px;
    }

    .t2t-transform-grid {
      grid-template-columns: 1fr;
    }

    .t2t-arrow-wrap {
      margin: -2px 0;
    }

    .t2t-arrow-circle {
      transform: rotate(90deg);
    }

    .t2t-transform-image.whatsapp img,
    .t2t-transform-image.preview img {
      height: 280px;
    }

    .t2t-demo-grid,
    .t2t-workspace-grid,
    .t2t-pricing-grid {
      grid-template-columns: 1fr;
    }

    .t2t-workflow-track {
      max-width: 620px;
      grid-template-columns: 1fr;
      gap: 26px;
      margin-top: 30px;
    }

    .t2t-workflow-line {
      top: 26px;
      bottom: 26px;
      left: 26px;
      right: auto;
      width: 2px;
      height: auto;
      background: linear-gradient(
        180deg,
        rgba(79, 70, 229, 0.12),
        rgba(79, 70, 229, 0.36),
        rgba(124, 58, 237, 0.12)
      );
    }

    .t2t-workflow-line::before,
    .t2t-workflow-line::after {
      display: none;
    }

    .t2t-workflow-step {
      display: grid;
      grid-template-columns: 52px 1fr;
      gap: 18px;
      padding: 0;
      text-align: left;
      align-items: flex-start;
    }

    .t2t-workflow-number {
      margin: 0;
      box-shadow:
        0 14px 30px rgba(79, 70, 229, 0.12),
        0 0 0 7px rgba(255, 255, 255, 0.9),
        inset 0 1px 0 rgba(255,255,255,0.95);
    }

    .t2t-workflow-content {
      margin-top: 2px;
    }

    .t2t-workflow-content p {
      margin-left: 0;
      margin-right: 0;
      max-width: 460px;
    }
  }

  @media (max-width: 640px) {
    .t2t-header,
    .t2t-main {
      width: min(100% - 24px, 1180px);
    }

    .t2t-header {
      padding-top: 14px;
    }

    .t2t-logo img {
      width: 136px;
    }

    .t2t-nav-cta {
      height: 38px;
      padding: 0 14px;
      font-size: 12px;
    }

    .t2t-hero h1 {
      font-size: 40px;
      line-height: 1.08;
    }

    .t2t-hero h1 span {
      white-space: normal;
    }

    .t2t-hero-copy p {
      font-size: 17px;
    }

    .t2t-transform-heading h2 {
      font-size: 28px;
    }

    .t2t-workflow h2 {
      font-size: 28px;
    }

    .t2t-workflow-track {
      gap: 24px;
    }

    .t2t-bottom-cta {
      flex-direction: column;
      align-items: stretch;
    }

    .t2t-bottom-cta a {
      width: 100%;
    }
  }
`;