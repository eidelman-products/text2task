"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import CustomerStoriesSection from "./customer-stories-section";

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

const proofSteps = [
  {
    step: "1",
    label: "Client WhatsApp message",
    src: "/landing/text2task-client-whatsapp-graphic-designers.png",
    alt: "Client WhatsApp message with graphic design revision request.",
    title: "Client WhatsApp message",
  },
  {
    step: "2",
    label: "AI extracts the work",
    src: "/landing/text2task-client-whatsapp-graphic-designers extracted.png",
    alt: "Text2Task AI extraction preview from a client WhatsApp message.",
    title: "AI extraction preview",
  },
  {
    step: "3",
    label: "Saved in the CRM",
    src: "/landing/New-Task-CRM.png",
    alt: "Extracted client task saved inside the Text2Task CRM.",
    title: "Saved CRM task",
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

type LightboxImage = {
  title: string;
  image: string;
  alt: string;
  ctaText: string;
  ctaHref: string;
};

export default function HeroSection() {
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(
    null
  );

  useEffect(() => {
    if (!lightboxImage) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLightboxImage(null);
      }
    }

    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [lightboxImage]);

  const openLightbox = (payload: LightboxImage) => {
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

        <nav className="t2t-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#demo">Demo</a>
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <Link href="/about">About</Link>
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
              Turn messy client requests into{" "}
              <span>ready-to-work projects.</span>
            </h1>

            <p>
              Text2Task turns emails, WhatsApp messages, screenshots, notes, and
              client revisions into clean projects with tasks, budgets,
              deadlines, and client details.
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
          <div className="t2t-section-heading">
            <h2>From client message to organized work.</h2>
            <p>
              A real client request can move from messy communication to AI
              extraction and finally into your workspace.
            </p>
          </div>

          <div className="t2t-proof-flow">
            {proofSteps.map((image, index) => (
              <div key={image.src} className="t2t-proof-step">
                {index > 0 ? (
                  <div className="t2t-proof-connector" aria-hidden="true">
                    -&gt;
                  </div>
                ) : null}

                <button
                  type="button"
                  className="t2t-proof-card"
                  onClick={() =>
                    openLightbox({
                      title: image.title,
                      image: image.src,
                      alt: image.alt,
                      ctaText: "Try Text2Task free",
                      ctaHref: "/signup",
                    })
                  }
                  aria-label={`Open preview: ${image.alt}`}
                >
                  <div className="t2t-proof-image">
                    <Image
                      src={image.src}
                      alt={image.alt}
                      width={1400}
                      height={900}
                      priority={index === 0}
                    />
                  </div>

                  <div className="t2t-proof-label">
                    <span>{image.step}</span>
                    <strong>{image.label}</strong>
                  </div>

                  <div className="t2t-proof-hover">Click to enlarge</div>
                </button>
              </div>
            ))}
          </div>

          <div className="t2t-transform-cta-row">
            <Link href="/signup" className="t2t-soft-cta">
              Try with your own client message
            </Link>
          </div>
        </section>

        <section id="demo" className="t2t-demo-section">
          <div className="t2t-section-heading compact">
            <h2>Watch the real Text2Task demo.</h2>
            <p>
              See how a client request becomes organized work inside the system.
            </p>
          </div>

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

            <div id="how-it-works" className="t2t-demo-steps">
              <Step
                number="1"
                title="Paste a request"
                text="Add a client message, email, note, or screenshot."
              />
              <Step
                number="2"
                title="AI extracts the work"
                text="It finds the project, tasks, budget, deadline, and client details."
              />
              <Step
                number="3"
                title="Review & save"
                text="Check the draft, edit details, and save only when it looks right."
              />
            </div>
          </div>
        </section>

        <section id="features" className="t2t-workflow">
          <div className="t2t-section-heading compact">
            <h2>From client request to organized work.</h2>
          </div>

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
          <div className="t2t-section-heading">
            <h2>Manage everything in one clean workspace.</h2>
            <p>
              Keep extracted client work, urgent tasks, deadlines, and project
              updates connected in one organized CRM.
            </p>
          </div>

          <div className="t2t-workspace-premium">
            <button
              type="button"
              className="t2t-workspace-main-preview"
              onClick={() =>
                openLightbox({
                  title: "Task CRM preview",
                  image: "/landing/New-Task-CRM.png",
                  alt: "Text2Task CRM showing extracted client work saved as organized projects and tasks.",
                  ctaText: "Try Text2Task free",
                  ctaHref: "/signup",
                })
              }
              aria-label="Open Task CRM preview"
            >
              <Image
                src="/landing/New-Task-CRM.png"
                alt="Text2Task CRM showing extracted client work saved as organized projects and tasks."
                width={1400}
                height={900}
              />

              <span>View CRM preview</span>
            </button>

            <button
              type="button"
              className="t2t-workspace-floating-preview"
              onClick={() =>
                openLightbox({
                  title: "Urgent Tasks Board preview",
                  image: "/landing/text2task-urgent-board.png",
                  alt: "Text2Task urgent tasks board with upcoming client tasks.",
                  ctaText: "Try Text2Task free",
                  ctaHref: "/signup",
                })
              }
              aria-label="Open Urgent Tasks Board preview"
            >
              <div>
                <strong>Urgent work stays visible</strong>
                <p>See what needs attention before it gets missed.</p>
              </div>

              <Image
                src="/landing/text2task-urgent-board.png"
                alt="Text2Task urgent tasks board with upcoming client tasks."
                width={1200}
                height={680}
              />

              <span>View urgent board</span>
            </button>

            <div className="t2t-workspace-badge" aria-hidden="true">
              Organized workspace
            </div>
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
                  width={1400}
                  height={900}
                  priority
                />
              </div>

              <Link href={lightboxImage.ctaHref} className="t2t-lightbox-cta">
                {lightboxImage.ctaText}
              </Link>
            </div>
          </div>
        ) : null}

        <CustomerStoriesSection />

        <section id="pricing" className="t2t-pricing">
          <div className="t2t-section-heading compact">
            <h2>Start free. Upgrade when you need more.</h2>
          </div>

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
      radial-gradient(circle at 16% 8%, rgba(199, 210, 254, 0.34), transparent 30%),
      radial-gradient(circle at 88% 10%, rgba(221, 214, 254, 0.26), transparent 28%),
      radial-gradient(circle at 48% 54%, rgba(219, 234, 254, 0.20), transparent 36%),
      linear-gradient(180deg, #ffffff 0%, #fbfbff 44%, #f8fbff 72%, #ffffff 100%);
    color: #0f172a;
  }

  .t2t-page * {
    box-sizing: border-box;
  }

  .t2t-header {
    width: min(1180px, calc(100% - 40px));
    margin: 0 auto;
    padding: 20px 0 8px;
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
    font-weight: 850;
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
    background: linear-gradient(135deg, #4f46e5, #6d28d9);
    color: white;
    text-decoration: none;
    font-size: 13px;
    font-weight: 950;
    box-shadow: 0 16px 36px rgba(79, 70, 229, 0.18);
    transition: transform 160ms ease, box-shadow 160ms ease;
  }

  .t2t-nav-cta:hover {
    transform: translateY(-1px);
    box-shadow: 0 20px 42px rgba(79, 70, 229, 0.22);
  }

  .t2t-main {
    width: min(1180px, calc(100% - 40px));
    margin: 0 auto;
    padding-bottom: 28px;
  }

  .t2t-hero {
    display: flex;
    justify-content: center;
    padding: 78px 0 52px;
    text-align: center;
  }

  .t2t-hero-copy {
    max-width: 920px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .t2t-hero h1 {
    margin: 0;
    max-width: 940px;
    font-size: clamp(48px, 6.2vw, 82px);
    line-height: 1.03;
    letter-spacing: -0.045em;
    font-weight: 950;
  }

  .t2t-hero h1 span {
    color: #4f46e5;
  }

  .t2t-hero-copy p {
    margin: 22px auto 0;
    font-size: clamp(18px, 2vw, 22px);
    line-height: 1.62;
    color: #475569;
    max-width: 780px;
    font-weight: 560;
  }

  .t2t-actions {
    margin-top: 30px;
    display: flex;
    justify-content: center;
    gap: 14px;
    flex-wrap: wrap;
  }

  .t2t-primary,
  .t2t-secondary {
    height: 46px;
    padding: 0 24px;
    border-radius: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    font-size: 14px;
    font-weight: 950;
    transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
  }

  .t2t-primary {
    background: linear-gradient(135deg, #4f46e5, #6d28d9);
    color: white;
    box-shadow: 0 16px 36px rgba(79, 70, 229, 0.18);
  }

  .t2t-secondary {
    background: rgba(255,255,255,0.9);
    color: #0f172a;
    border: 1px solid #dbe4f0;
    box-shadow: 0 12px 28px rgba(15, 23, 42, 0.05);
  }

  .t2t-primary:hover,
  .t2t-secondary:hover {
    transform: translateY(-1px);
  }

  .t2t-transform-section,
  .t2t-demo-section,
  .t2t-workflow,
  .t2t-workspace,
  .t2t-pricing {
    padding: 42px 0;
  }

  .t2t-section-heading {
    margin: 0 auto 26px;
    max-width: 760px;
    text-align: center;
  }

  .t2t-section-heading.compact {
    margin-bottom: 24px;
  }

  .t2t-section-heading h2 {
    margin: 0 auto;
    max-width: 760px;
    color: #0f172a;
    font-size: clamp(30px, 3vw, 42px);
    line-height: 1.08;
    letter-spacing: -0.055em;
    font-weight: 950;
  }

  .t2t-section-heading p {
    margin: 14px auto 0;
    max-width: 650px;
    color: #64748b;
    font-size: 15px;
    line-height: 1.72;
    font-weight: 620;
  }

  .t2t-proof-flow {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 20px;
    align-items: stretch;
    margin-top: 30px;
    padding: 24px;
    border-radius: 34px;
    border: 1px solid rgba(226, 232, 240, 0.72);
    background:
      radial-gradient(circle at 18% 16%, rgba(219, 234, 254, 0.46), transparent 32%),
      radial-gradient(circle at 82% 18%, rgba(238, 242, 255, 0.70), transparent 34%),
      rgba(255,255,255,0.50);
    box-shadow: 0 26px 90px rgba(15, 23, 42, 0.052);
  }

  .t2t-proof-step {
    position: relative;
    min-width: 0;
  }

  .t2t-proof-connector {
    pointer-events: none;
    position: absolute;
    left: -29px;
    top: 41%;
    z-index: 10;
    width: 40px;
    height: 40px;
    border-radius: 999px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(199,210,254,0.88);
    background: rgba(255,255,255,0.94);
    color: #4f46e5;
    font-size: 18px;
    font-weight: 950;
    box-shadow: 0 14px 34px rgba(79,70,229,0.10);
  }

  .t2t-proof-card {
    position: relative;
    width: 100%;
    min-width: 0;
    height: 100%;
    display: grid;
    grid-template-rows: 1fr auto;
    overflow: hidden;
    border: 1px solid rgba(226, 232, 240, 0.95);
    border-radius: 28px;
    background: rgba(255,255,255,0.92);
    padding: 12px;
    cursor: pointer;
    text-align: left;
    box-shadow:
      0 24px 70px rgba(15, 23, 42, 0.07),
      inset 0 1px 0 rgba(255,255,255,0.94);
    transition: transform 170ms ease, box-shadow 170ms ease, border-color 170ms ease;
  }

  .t2t-proof-card:hover {
    transform: translateY(-3px);
    border-color: rgba(165, 180, 252, 0.95);
    box-shadow:
      0 34px 88px rgba(79, 70, 229, 0.10),
      inset 0 1px 0 rgba(255,255,255,0.96);
  }

  .t2t-proof-card:focus-visible {
    outline: 4px solid rgba(99,102,241,0.22);
    outline-offset: 4px;
  }

  .t2t-proof-image {
    overflow: hidden;
    border-radius: 20px;
    border: 1px solid rgba(203, 213, 225, 0.88);
    background: #f8fafc;
  }

  .t2t-proof-image img {
    display: block;
    width: 100%;
    height: 225px;
    object-fit: contain;
    object-position: center;
    background: #f8fafc;
  }

  .t2t-proof-label {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 14px 4px 2px;
  }

  .t2t-proof-label span {
    display: flex;
    width: 32px;
    height: 32px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: #eef2ff;
    color: #4f46e5;
    font-size: 12px;
    font-weight: 950;
  }

  .t2t-proof-label strong {
    color: #0f172a;
    font-size: 14px;
    line-height: 1.2;
    font-weight: 950;
  }

  .t2t-proof-hover {
    pointer-events: none;
    position: absolute;
    right: 22px;
    top: 22px;
    border-radius: 999px;
    border: 1px solid rgba(255,255,255,0.75);
    background: rgba(15,23,42,0.72);
    color: white;
    padding: 7px 11px;
    font-size: 11px;
    font-weight: 950;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 160ms ease, transform 160ms ease;
    backdrop-filter: blur(10px);
  }

  .t2t-proof-card:hover .t2t-proof-hover,
  .t2t-proof-card:focus-visible .t2t-proof-hover {
    opacity: 1;
    transform: translateY(0);
  }

  .t2t-transform-cta-row {
    display: flex;
    justify-content: center;
    margin-top: 22px;
  }

  .t2t-soft-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 22px;
    border-radius: 16px;
    background: rgba(238, 242, 255, 0.72);
    color: #4338ca;
    text-decoration: none;
    font-size: 14px;
    font-weight: 950;
    border: 1px solid rgba(199, 210, 254, 0.9);
    transition: transform 160ms ease, background 160ms ease;
  }

  .t2t-soft-cta:hover {
    transform: translateY(-1px);
    background: rgba(238, 242, 255, 0.95);
  }

  .t2t-demo-grid {
    max-width: 920px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 34px;
    align-items: center;
    padding: 22px;
    border-radius: 32px;
    border: 1px solid rgba(226,232,240,0.74);
    background: rgba(255,255,255,0.58);
    box-shadow: 0 24px 80px rgba(15,23,42,0.055);
  }

  .t2t-video-card {
    overflow: hidden;
    border-radius: 26px;
    background: #020617;
    padding: 10px;
    box-shadow: 0 28px 72px rgba(15, 23, 42, 0.18);
  }

  .t2t-video-top {
    height: 34px;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0 9px;
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
    color: #cbd5e1;
    font-size: 11px;
    font-weight: 850;
  }

  .t2t-video {
    display: block;
    width: 100%;
    max-height: 280px;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    border-radius: 18px;
    background: #020617;
  }

  .t2t-demo-steps {
    display: grid;
    gap: 18px;
  }

  .t2t-step {
    display: flex;
    gap: 14px;
    align-items: flex-start;
  }

  .t2t-step-icon {
    width: 42px;
    height: 42px;
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
    line-height: 1.58;
    font-weight: 640;
  }

  .t2t-workflow {
    position: relative;
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
      rgba(99, 102, 241, 0.12),
      rgba(99, 102, 241, 0.34),
      rgba(79, 70, 229, 0.34),
      rgba(99, 102, 241, 0.12)
    );
    z-index: 0;
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
      linear-gradient(135deg, #eef2ff, #f8fafc);
    border: 1px solid rgba(199, 210, 254, 0.92);
    color: #4f46e5;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 15px;
    font-weight: 950;
    box-shadow:
      0 14px 30px rgba(79, 70, 229, 0.10),
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
    font-weight: 610;
  }

  .t2t-workspace-premium {
    position: relative;
    max-width: 960px;
    min-height: 520px;
    margin: 34px auto 0;
  }

  .t2t-workspace-main-preview {
    position: absolute;
    left: 0;
    top: 24px;
    width: 72%;
    overflow: hidden;
    border: 1px solid rgba(226,232,240,0.92);
    border-radius: 34px;
    background:
      radial-gradient(circle at 15% 0%, rgba(238,242,255,0.72), transparent 34%),
      linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.9));
    padding: 14px;
    cursor: pointer;
    text-align: left;
    box-shadow:
      0 30px 90px rgba(15,23,42,0.08),
      inset 0 1px 0 rgba(255,255,255,0.96);
    transition: transform 170ms ease, box-shadow 170ms ease, border-color 170ms ease;
  }

  .t2t-workspace-main-preview:hover {
    transform: translateY(-4px);
    border-color: rgba(165,180,252,0.95);
    box-shadow:
      0 40px 110px rgba(79,70,229,0.13),
      inset 0 1px 0 rgba(255,255,255,0.98);
  }

  .t2t-workspace-main-preview:focus-visible,
  .t2t-workspace-floating-preview:focus-visible {
    outline: 4px solid rgba(99,102,241,0.22);
    outline-offset: 4px;
  }

  .t2t-workspace-main-preview img {
    display: block;
    width: 100%;
    height: 390px;
    object-fit: contain;
    object-position: center;
    border-radius: 24px;
    border: 1px solid rgba(203,213,225,0.9);
    background: #f8fafc;
  }

  .t2t-workspace-main-preview span {
    position: absolute;
    right: 28px;
    top: 28px;
    border-radius: 999px;
    background: rgba(79,70,229,0.08);
    color: #4f46e5;
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 950;
    letter-spacing: 0.11em;
    text-transform: uppercase;
    box-shadow: 0 10px 24px rgba(79,70,229,0.06);
  }

  .t2t-workspace-floating-preview {
    position: absolute;
    right: 0;
    bottom: 8px;
    z-index: 4;
    width: 45%;
    overflow: hidden;
    border: 1px solid rgba(226,232,240,0.95);
    border-radius: 30px;
    background:
      radial-gradient(circle at 85% 0%, rgba(219,234,254,0.72), transparent 34%),
      linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.92));
    padding: 15px;
    cursor: pointer;
    text-align: left;
    box-shadow:
      0 32px 88px rgba(15,23,42,0.11),
      0 18px 54px rgba(79,70,229,0.08),
      inset 0 1px 0 rgba(255,255,255,0.96);
    transition: transform 170ms ease, box-shadow 170ms ease, border-color 170ms ease;
  }

  .t2t-workspace-floating-preview:hover {
    transform: translateY(-4px);
    border-color: rgba(165,180,252,0.95);
    box-shadow:
      0 42px 110px rgba(79,70,229,0.14),
      0 18px 54px rgba(15,23,42,0.08),
      inset 0 1px 0 rgba(255,255,255,0.98);
  }

  .t2t-workspace-floating-preview div {
    margin-bottom: 12px;
    padding-right: 110px;
  }

  .t2t-workspace-floating-preview strong {
    display: block;
    color: #0f172a;
    font-size: 16px;
    line-height: 1.2;
    font-weight: 950;
    letter-spacing: -0.03em;
  }

  .t2t-workspace-floating-preview p {
    margin: 5px 0 0;
    color: #64748b;
    font-size: 12px;
    line-height: 1.45;
    font-weight: 680;
  }

  .t2t-workspace-floating-preview img {
    display: block;
    width: 100%;
    height: 210px;
    object-fit: contain;
    object-position: center;
    border-radius: 20px;
    border: 1px solid rgba(203,213,225,0.9);
    background: #f8fafc;
  }

  .t2t-workspace-floating-preview span {
    position: absolute;
    right: 20px;
    top: 20px;
    border-radius: 999px;
    background: rgba(79,70,229,0.08);
    color: #4f46e5;
    padding: 7px 10px;
    font-size: 10px;
    font-weight: 950;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .t2t-workspace-badge {
    position: absolute;
    left: 52%;
    top: 10px;
    z-index: 5;
    transform: translateX(-50%);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 40px;
    padding: 0 17px;
    border-radius: 999px;
    border: 1px solid rgba(199,210,254,0.9);
    background: rgba(255,255,255,0.9);
    color: #4338ca;
    font-size: 12px;
    font-weight: 950;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    box-shadow: 0 18px 42px rgba(79,70,229,0.10);
  }

  .t2t-lightbox-overlay {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(15, 23, 42, 0.76);
    padding: 22px;
    z-index: 9999;
    backdrop-filter: blur(10px);
  }

  .t2t-lightbox-panel {
    position: relative;
    width: min(100%, 1080px);
    max-height: min(100%, 96vh);
    padding: 28px;
    background: rgba(255, 255, 255, 0.98);
    border-radius: 30px;
    box-shadow: 0 34px 90px rgba(15, 23, 42, 0.22);
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
    border-radius: 24px;
    overflow: hidden;
    border: 1px solid rgba(226, 232, 240, 0.95);
    background: #f8fafc;
  }

  .t2t-lightbox-image img {
    width: 100%;
    height: auto;
    max-height: 68vh;
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
    background: linear-gradient(135deg, #4f46e5, #6d28d9);
    color: white;
    text-decoration: none;
    font-size: 14px;
    font-weight: 900;
  }

  .t2t-pricing-grid {
    max-width: 760px;
    margin: 24px auto 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 22px;
  }

  .t2t-price-card {
    position: relative;
    background:
      linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.92));
    border: 1px solid rgba(226, 232, 240, 0.96);
    border-radius: 28px;
    padding: 28px;
    box-shadow:
      0 20px 58px rgba(15, 23, 42, 0.07),
      inset 0 1px 0 rgba(255,255,255,0.94);
    transition: transform 170ms ease, box-shadow 170ms ease, border-color 170ms ease, background 170ms ease;
  }

  .t2t-price-card:hover {
    transform: translateY(-4px);
    border-color: #c7d2fe;
    background:
      linear-gradient(180deg, #ffffff, #f8f7ff);
    box-shadow:
      0 34px 82px rgba(79, 70, 229, 0.12),
      inset 0 1px 0 rgba(255,255,255,0.96);
  }

  .t2t-price-card.popular {
    border-color: rgba(129, 140, 248, 0.84);
    background:
      radial-gradient(circle at 85% 0%, rgba(129, 140, 248, 0.12), transparent 34%),
      linear-gradient(180deg, rgba(255,255,255,0.99), rgba(248,250,252,0.94));
  }

  .t2t-popular {
    position: absolute;
    top: -14px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #4f46e5, #6d28d9);
    color: white;
    border-radius: 999px;
    padding: 7px 18px;
    font-size: 11px;
    font-weight: 950;
    box-shadow: 0 14px 30px rgba(79, 70, 229, 0.20);
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
    background: linear-gradient(135deg, #4f46e5, #6d28d9);
    color: white;
    text-decoration: none;
    font-size: 13px;
    font-weight: 950;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 14px 34px rgba(79, 70, 229, 0.16);
    transition: transform 160ms ease, box-shadow 160ms ease;
  }

  .t2t-price-card a:hover {
    transform: translateY(-1px);
    box-shadow: 0 20px 44px rgba(79, 70, 229, 0.24);
  }

  .t2t-bottom-cta {
    margin: 32px auto 0;
    max-width: 930px;
    border-radius: 28px;
    background:
      radial-gradient(circle at top left, rgba(199,210,254,0.5), transparent 34%),
      linear-gradient(135deg, #f8fafc, #eef2ff);
    border: 1px solid #dbe4f0;
    padding: 26px 30px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    box-shadow: 0 18px 54px rgba(79, 70, 229, 0.07);
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
    font-weight: 650;
  }

  .t2t-bottom-cta a {
    height: 44px;
    min-width: 170px;
    border-radius: 15px;
    background: linear-gradient(135deg, #4f46e5, #6d28d9);
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
      padding-top: 44px;
    }

    .t2t-hero-copy {
      max-width: 720px;
    }

    .t2t-proof-flow,
    .t2t-demo-grid,
    .t2t-pricing-grid {
      grid-template-columns: 1fr;
    }

    .t2t-proof-flow {
      padding: 18px;
    }

    .t2t-proof-connector {
      left: 50%;
      top: -28px;
      transform: translateX(-50%) rotate(90deg);
    }

    .t2t-proof-image img {
      height: 300px;
    }

    .t2t-workspace-premium {
      min-height: auto;
      display: grid;
      gap: 18px;
    }

    .t2t-workspace-main-preview,
    .t2t-workspace-floating-preview {
      position: relative;
      left: auto;
      right: auto;
      top: auto;
      bottom: auto;
      width: 100%;
    }

    .t2t-workspace-main-preview img {
      height: 320px;
    }

    .t2t-workspace-floating-preview img {
      height: 260px;
    }

    .t2t-workspace-badge {
      position: relative;
      left: auto;
      top: auto;
      transform: none;
      justify-self: center;
      order: -1;
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
        rgba(79, 70, 229, 0.34),
        rgba(79, 70, 229, 0.12)
      );
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

    .t2t-hero {
      padding: 42px 0 34px;
    }

    .t2t-hero h1 {
      font-size: 42px;
      line-height: 1.08;
    }

    .t2t-hero-copy p {
      font-size: 17px;
    }

    .t2t-section-heading h2 {
      font-size: 30px;
    }

    .t2t-transform-section,
    .t2t-demo-section,
    .t2t-workflow,
    .t2t-workspace,
    .t2t-pricing {
      padding: 34px 0;
    }

    .t2t-proof-image img,
    .t2t-workspace-main-preview img,
    .t2t-workspace-floating-preview img {
      height: 260px;
    }

    .t2t-workspace-floating-preview div {
      padding-right: 0;
    }

    .t2t-workspace-main-preview span,
    .t2t-workspace-floating-preview span {
      position: static;
      width: fit-content;
      margin-top: 12px;
      display: inline-flex;
    }

    .t2t-proof-flow,
    .t2t-demo-grid {
      padding: 14px;
      border-radius: 26px;
    }

    .t2t-lightbox-panel {
      width: 100%;
      max-height: 100%;
      padding: 20px;
      border-radius: 22px;
    }

    .t2t-lightbox-panel h3 {
      font-size: 23px;
    }

    .t2t-pricing-grid {
      grid-template-columns: 1fr;
    }

    .t2t-bottom-cta {
      flex-direction: column;
      align-items: stretch;
      padding: 24px;
    }

    .t2t-bottom-cta a {
      width: 100%;
    }
  }
`;