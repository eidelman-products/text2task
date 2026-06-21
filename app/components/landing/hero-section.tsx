"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import CustomerStoriesSection from "./customer-stories-section";
import LandingHeader from "./landing-header";

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
  "Project CRM workspace",
  "Client updates & history",
  "Resource attachments",
];

const proPlan = [
  "Unlimited AI extracts",
  "Text + image extraction",
  "Review before saving",
  "Project CRM workspace",
  "Client updates & history",
  "Resource attachments",
  "CSV export",
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

      <LandingHeader />

      <main className="t2t-main">
        <section className="t2t-hero">
          <div className="t2t-hero-copy">
            <h1>
              <span className="t2t-hero-line">
                Stop copying client requests.
              </span>
              <span className="t2t-hero-line">
                Let Text2Task turn them into
              </span>
              <span className="t2t-hero-line t2t-hero-value">
                ready-to-work projects.
              </span>
            </h1>

            <p>
              Paste a WhatsApp message, email, screenshot, or client note.
              Text2Task does the hard work. You stay in control.
            </p>
          </div>

          <button
            type="button"
            className="t2t-hero-visual"
            onClick={() =>
              openLightbox({
                title: "Client WhatsApp request",
                image:
                  "/landing/text2task-client-whatsapp-social-media-managers.png",
                alt: "Detailed client WhatsApp request ready to be organized with Text2Task.",
                ctaText: "Try Text2Task free",
                ctaHref: "/signup",
              })
            }
            aria-label="Open client WhatsApp request preview"
          >
            <Image
              src="/landing/text2task-client-whatsapp-social-media-managers.png"
              alt="Detailed client WhatsApp request ready to be organized with Text2Task."
              width={1450}
              height={1086}
              priority
            />
          </button>

          <div className="t2t-actions">
            <Link href="/signup" className="t2t-primary">
              Start for free
            </Link>
            <a href="#demo" className="t2t-secondary">
              Watch demo
            </a>
            <p className="t2t-hero-auth-helper">
              Start with Google or email. 30 AI extracts included.
            </p>
          </div>
        </section>

        <section className="t2t-transform-section">
          <div className="t2t-section-heading">
            <h2>
              Just paste text or upload an image.
              <br />
              Text2Task extracts the work for you.
            </h2>
            <p>
              Text2Task finds the tasks, deadline, budget, and client details —
              then lets you review everything before saving.
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
              Try it with your own request →
            </Link>
          </div>
        </section>

        <section id="demo" className="t2t-demo-section">
          <div className="t2t-section-heading compact">
            <h2>Watch a client request become a project.</h2>
            <p>
              See how one message becomes a clean project draft you can review
              and save.
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
                text="Text2Task finds the task, deadline, budget, and client details."
              />
              <Step
                number="3"
                title="Review & save"
                text="Check the draft, edit anything, and save it when it looks right."
              />
            </div>
          </div>
        </section>

        <section id="features" className="t2t-workspace">
          <div className="t2t-section-heading">
            <h2>
              Keep client projects organized
              <br className="t2t-workspace-heading-break" /> in one workspace.
            </h2>
            <p>
              Track extracted projects, urgent tasks, deadlines, and project
              updates in one clean CRM.
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
            </button>
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

        <div className="t2t-customer-stories-wrap">
          <div className="t2t-customer-stories-intro">
            <h2>Real feedback from people using Text2Task.</h2>
            <p>
              A small look at how users organize client requests, projects, and
              follow-ups.
            </p>
          </div>

          <CustomerStoriesSection />
        </div>

        <section id="pricing" className="t2t-pricing">
          <div className="t2t-section-heading compact">
            <h2>Start free. Upgrade when you’re ready.</h2>
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

      {title === "Free" ? (
        <p className="t2t-price-helper">
          Create your workspace with Google or email.
        </p>
      ) : null}
    </div>
  );
}

const styles = `
  .t2t-page {
    min-height: 100vh;
    background: linear-gradient(180deg, #ffffff 0%, #fbfdff 48%, #ffffff 100%);
    color: #0f172a;
  }

  .t2t-page * {
    box-sizing: border-box;
  }

  .t2t-header {
    width: min(1180px, calc(100% - 40px));
    margin: 0 auto;
    padding: 16px 0 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    border-bottom: 1px solid rgba(226, 232, 240, 0.72);
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
    gap: 23px;
    font-size: 13px;
    font-weight: 750;
  }

  .t2t-nav a {
    color: #475569;
    text-decoration: none;
    transition: color 160ms ease;
  }

  .t2t-nav a:hover {
    color: #1d4ed8;
  }

  .t2t-nav-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 42px;
    padding: 0 19px;
    border-radius: 12px;
    border: 1px solid #2563eb;
    background: #2563eb;
    color: white;
    text-decoration: none;
    font-size: 13px;
    font-weight: 850;
    box-shadow: 0 10px 24px rgba(37, 99, 235, 0.18);
    transition: transform 160ms ease, box-shadow 160ms ease;
  }

  .t2t-nav-cta:hover {
    transform: translateY(-1px);
    box-shadow: 0 14px 30px rgba(37, 99, 235, 0.22);
  }

  .t2t-main {
    width: min(1180px, calc(100% - 40px));
    margin: 0 auto;
    padding-bottom: 28px;
  }

  .t2t-hero {
    display: grid;
    grid-template-columns: minmax(0, 655px) minmax(0, 495px);
    grid-template-areas:
      "copy visual"
      "actions visual";
    column-gap: 24px;
    row-gap: 28px;
    align-items: center;
    padding: 86px 0 56px;
    text-align: left;
  }

  .t2t-hero-copy {
    grid-area: copy;
    width: 100%;
    max-width: 655px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .t2t-hero h1 {
    margin: 0;
    max-width: 655px;
    font-size: clamp(43px, 4vw, 49px);
    line-height: 1.14;
    letter-spacing: -0.05em;
    font-weight: 950;
  }

  .t2t-hero-line {
    display: block;
    white-space: nowrap;
  }

  .t2t-hero-value {
    color: #2563eb;
  }

  .t2t-hero-copy p {
    margin: 28px 0 0;
    font-size: clamp(16px, 1.55vw, 19px);
    line-height: 1.58;
    color: #475569;
    max-width: 530px;
    font-weight: 540;
  }

  .t2t-actions {
    grid-area: actions;
    margin-top: 0;
    display: flex;
    justify-content: flex-start;
    align-self: start;
    gap: 14px;
    flex-wrap: wrap;
  }

  .t2t-hero-auth-helper {
    flex-basis: 100%;
    margin: 0;
    color: #64748b;
    font-size: 12px;
    line-height: 1.5;
    font-weight: 700;
  }

  .t2t-primary,
  .t2t-secondary {
    height: 46px;
    padding: 0 22px;
    border-radius: 13px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    font-size: 14px;
    font-weight: 850;
    transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
  }

  .t2t-primary {
    border: 1px solid #2563eb;
    background: #2563eb;
    color: white;
    box-shadow: 0 12px 28px rgba(37, 99, 235, 0.18);
  }

  .t2t-secondary {
    background: rgba(255, 255, 255, 0.92);
    color: #334155;
    border: 1px solid rgba(203, 213, 225, 0.92);
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.045);
  }

  .t2t-primary:hover,
  .t2t-secondary:hover {
    transform: translateY(-1px);
  }

  .t2t-hero-visual {
    grid-area: visual;
    width: 100%;
    margin: 0;
    padding: 0;
    justify-self: end;
    align-self: center;
    overflow: hidden;
    border: 1px solid rgba(203, 213, 225, 0.78);
    border-radius: 18px;
    background: rgba(37, 99, 235, 0.085);
    box-shadow: 0 10px 32px rgba(15, 23, 42, 0.055);
    cursor: pointer;
    transform: translateY(30px);
    transition: transform 170ms ease, border-color 170ms ease, box-shadow 170ms ease;
  }

  .t2t-hero-visual:hover {
    transform: translateY(27px);
    border-color: rgba(147, 197, 253, 0.9);
    box-shadow: 0 14px 38px rgba(37, 99, 235, 0.075);
  }

  .t2t-hero-visual:focus-visible {
    outline: 4px solid rgba(37, 99, 235, 0.18);
    outline-offset: 4px;
  }

  .t2t-hero-visual img {
    display: block;
    width: 100%;
    height: auto;
  }

  .t2t-transform-section,
  .t2t-demo-section,
  .t2t-workspace,
  .t2t-pricing {
    padding: 48px 0;
  }

  .t2t-transform-section {
    padding-top: 68px;
  }

  .t2t-transform-section .t2t-section-heading {
    max-width: none;
    margin: 0 0 20px;
    text-align: left;
  }

  .t2t-transform-section .t2t-section-heading h2,
  .t2t-transform-section .t2t-section-heading p {
    margin-left: 0;
    margin-right: 0;
  }

  .t2t-transform-section .t2t-section-heading h2 {
    font-size: clamp(28px, 2.7vw, 38px);
    line-height: 1.16;
    font-weight: 700;
  }

  .t2t-demo-section {
    padding-top: 72px;
    padding-bottom: 42px;
  }

  .t2t-demo-section .t2t-section-heading {
    max-width: none;
    margin-left: 0;
    margin-right: 0;
    text-align: left;
  }

  .t2t-demo-section .t2t-section-heading h2,
  .t2t-demo-section .t2t-section-heading p {
    margin-left: 0;
    margin-right: 0;
  }

  .t2t-demo-section .t2t-section-heading h2 {
    line-height: 1.14;
    font-weight: 600;
  }

  .t2t-pricing {
    padding-top: 96px;
    padding-bottom: 38px;
  }

  .t2t-pricing .t2t-section-heading {
    max-width: none;
    margin-left: 0;
    margin-right: 0;
    text-align: left;
  }

  .t2t-pricing .t2t-section-heading h2 {
    margin-left: 0;
    margin-right: 0;
    font-size: clamp(28px, 2.7vw, 38px);
    line-height: 1.16;
    font-weight: 700;
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
    gap: 30px;
    align-items: stretch;
    margin-top: 10px;
    padding: 4px 0;
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  .t2t-proof-step {
    position: relative;
    min-width: 0;
  }

  .t2t-proof-connector {
    pointer-events: none;
    position: absolute;
    left: -30px;
    top: 37%;
    z-index: 10;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #93c5fd;
    font-size: 19px;
    font-weight: 750;
  }

  .t2t-proof-card {
    position: relative;
    width: 100%;
    min-width: 0;
    height: 100%;
    display: grid;
    grid-template-rows: 1fr auto;
    overflow: visible;
    border: 0;
    border-radius: 0;
    background: transparent;
    padding: 0;
    cursor: pointer;
    text-align: left;
    box-shadow: none;
    transition: transform 170ms ease, box-shadow 170ms ease, border-color 170ms ease;
  }

  .t2t-proof-card:hover {
    transform: translateY(-3px);
    box-shadow: none;
  }

  .t2t-proof-card:focus-visible {
    outline: 4px solid rgba(37, 99, 235, 0.18);
    outline-offset: 4px;
  }

  .t2t-proof-image {
    overflow: hidden;
    border-radius: 13px;
    border: 1px solid rgba(203, 213, 225, 0.52);
    background: #ffffff;
    box-shadow: 0 5px 18px rgba(15, 23, 42, 0.03);
    transition: border-color 170ms ease, box-shadow 170ms ease;
  }

  .t2t-proof-card:hover .t2t-proof-image {
    border-color: rgba(147, 197, 253, 0.88);
    box-shadow: 0 9px 24px rgba(37, 99, 235, 0.055);
  }

  .t2t-proof-image img {
    display: block;
    width: 100%;
    height: 238px;
    object-fit: contain;
    object-position: center;
    background: #f8fafc;
  }

  .t2t-proof-label {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 12px 2px 0;
  }

  .t2t-proof-label span {
    display: flex;
    width: 26px;
    height: 26px;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    background: rgba(239, 246, 255, 0.92);
    color: #2563eb;
    font-size: 10px;
    font-weight: 850;
    border: 1px solid rgba(191, 219, 254, 0.82);
  }

  .t2t-proof-label strong {
    color: #0f172a;
    font-size: 13px;
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
    margin-top: 20px;
  }

  .t2t-soft-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 22px;
    border-radius: 999px;
    background: #ffffff;
    color: #1d4ed8;
    text-decoration: none;
    font-size: 14px;
    font-weight: 750;
    border: 1px solid rgba(37, 99, 235, 0.14);
    box-shadow: 0 7px 20px rgba(37, 99, 235, 0.07);
    transition:
      transform 160ms ease,
      background 160ms ease,
      border-color 160ms ease,
      color 160ms ease,
      box-shadow 160ms ease;
  }

  .t2t-soft-cta:hover {
    transform: translateY(-1px);
    background: rgba(37, 99, 235, 0.13);
    border-color: rgba(37, 99, 235, 0.2);
    color: #1d4ed8;
    box-shadow: 0 10px 26px rgba(37, 99, 235, 0.1);
  }

  .t2t-demo-grid {
    max-width: 920px;
    margin: 36px 0 0;
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 22px;
    align-items: center;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  .t2t-video-card {
    overflow: hidden;
    border-radius: 16px;
    background: #0f172a;
    padding: 6px;
    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);
  }

  .t2t-video-top {
    height: 30px;
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
    border-radius: 12px;
    background: #020617;
  }

  .t2t-demo-steps {
    display: grid;
    gap: 22px;
    align-content: center;
  }

  .t2t-step {
    display: flex;
    gap: 13px;
    align-items: flex-start;
  }

  .t2t-step-icon {
    width: 34px;
    height: 34px;
    flex: 0 0 auto;
    border-radius: 999px;
    background: #eff6ff;
    color: #2563eb;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 800;
    border: 1px solid rgba(96, 165, 250, 0.82);
    box-shadow:
      0 4px 12px rgba(37, 99, 235, 0.08),
      0 0 0 3px rgba(239, 246, 255, 0.68);
  }

  .t2t-step h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  .t2t-step p {
    margin: 8px 0 0;
    color: #64748b;
    font-size: 13px;
    line-height: 1.58;
    font-weight: 520;
  }

  .t2t-workspace {
    padding-top: 72px;
  }

  .t2t-workspace .t2t-section-heading {
    max-width: none;
    margin-left: 0;
    margin-right: 0;
    text-align: left;
  }

  .t2t-workspace .t2t-section-heading h2,
  .t2t-workspace .t2t-section-heading p {
    margin-left: 0;
    margin-right: 0;
  }

  .t2t-workspace .t2t-section-heading h2 {
    font-size: clamp(28px, 2.7vw, 38px);
    line-height: 1.16;
    font-weight: 700;
  }

  .t2t-workspace-heading-break {
    display: block;
  }

  .t2t-workspace-premium {
    position: relative;
    max-width: 960px;
    min-height: 468px;
    margin: 24px auto 0;
  }

  .t2t-workspace-main-preview {
    position: absolute;
    left: 0;
    top: 24px;
    width: 72%;
    overflow: hidden;
    border: 1px solid rgba(226, 232, 240, 0.5);
    border-radius: 15px;
    background: #ffffff;
    padding: 8px;
    cursor: pointer;
    text-align: left;
    box-shadow: 0 5px 18px rgba(15, 23, 42, 0.026);
    transition: transform 170ms ease, box-shadow 170ms ease, border-color 170ms ease;
  }

  .t2t-workspace-main-preview:hover {
    transform: translateY(-4px);
    border-color: rgba(191, 219, 254, 0.72);
    box-shadow: 0 9px 26px rgba(37, 99, 235, 0.045);
  }

  .t2t-workspace-main-preview:focus-visible,
  .t2t-workspace-floating-preview:focus-visible {
    outline: 4px solid rgba(37, 99, 235, 0.18);
    outline-offset: 4px;
  }

  .t2t-workspace-main-preview img {
    display: block;
    width: 100%;
    height: 390px;
    object-fit: contain;
    object-position: center;
    border-radius: 13px;
    border: 1px solid rgba(203, 213, 225, 0.56);
    background: #f8fafc;
  }

  .t2t-workspace-floating-preview {
    position: absolute;
    right: 0;
    bottom: 8px;
    z-index: 4;
    width: 45%;
    overflow: hidden;
    border: 1px solid rgba(226, 232, 240, 0.58);
    border-radius: 15px;
    background: #ffffff;
    padding: 10px;
    cursor: pointer;
    text-align: left;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.042);
    transition: transform 170ms ease, box-shadow 170ms ease, border-color 170ms ease;
  }

  .t2t-workspace-floating-preview:hover {
    transform: translateY(-4px);
    border-color: rgba(191, 219, 254, 0.74);
    box-shadow: 0 11px 30px rgba(37, 99, 235, 0.052);
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
    border-radius: 12px;
    border: 1px solid rgba(203, 213, 225, 0.56);
    background: #f8fafc;
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
    background: #2563eb;
    color: white;
    text-decoration: none;
    font-size: 14px;
    font-weight: 900;
  }

  .t2t-customer-stories-wrap {
    padding: 34px 0 36px;
  }

  .t2t-customer-stories-wrap:not(:has(.t2t-customer-stories)) {
    display: none;
  }

  .t2t-customer-stories-intro {
    max-width: none;
    margin: 0 0 56px;
    text-align: left;
  }

  .t2t-customer-stories-intro h2 {
    margin: 0;
    color: #0f172a;
    font-size: clamp(28px, 2.7vw, 38px);
    line-height: 1.16;
    letter-spacing: -0.055em;
    font-weight: 700;
  }

  .t2t-customer-stories-intro p {
    max-width: 650px;
    margin: 14px 0 0;
    color: #64748b;
    font-size: 15px;
    line-height: 1.72;
    font-weight: 620;
  }

  .t2t-customer-stories-wrap .t2t-customer-stories {
    padding: 0;
  }

  .t2t-customer-stories-wrap .t2t-customer-stories-shell {
    max-width: none;
    margin-left: 0;
    margin-right: 0;
  }

  .t2t-customer-stories-wrap .t2t-customer-stories-header {
    display: none;
  }

  .t2t-customer-stories-wrap .t2t-customer-stories-grid {
    margin-left: 0;
    margin-right: auto;
  }

  .t2t-customer-stories-wrap .t2t-customer-story-card {
    border-color: rgba(226, 232, 240, 0.68);
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 5px 18px rgba(15, 23, 42, 0.028);
  }

  .t2t-customer-stories-wrap .t2t-customer-story-card:hover {
    border-color: rgba(203, 213, 225, 0.82);
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.045);
  }

  .t2t-customer-stories-wrap .t2t-customer-story-quote {
    color: rgba(59, 130, 246, 0.58);
  }

  .t2t-pricing-grid {
    max-width: 760px;
    margin: 56px auto 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }

  .t2t-price-card {
    position: relative;
    background: rgba(255, 255, 255, 0.94);
    border: 1px solid rgba(226, 232, 240, 0.58);
    border-radius: 22px;
    padding: 26px;
    box-shadow: 0 6px 20px rgba(15, 23, 42, 0.028);
    transition: transform 170ms ease, box-shadow 170ms ease, border-color 170ms ease, background 170ms ease;
  }

  .t2t-price-card:hover {
    transform: translateY(-2px);
    border-color: rgba(203, 213, 225, 0.78);
    background: #ffffff;
    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.045);
  }

  .t2t-price-card.popular {
    border-color: rgba(191, 219, 254, 0.62);
    background: linear-gradient(180deg, #ffffff, rgba(248, 251, 255, 0.58));
    box-shadow: 0 7px 22px rgba(37, 99, 235, 0.036);
  }

  .t2t-popular {
    position: absolute;
    top: 12px;
    right: 14px;
    border: 1px solid rgba(191, 219, 254, 0.56);
    background: rgba(239, 246, 255, 0.62);
    color: #2563eb;
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 10px;
    font-weight: 750;
    box-shadow: none;
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
    gap: 10px;
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
    border-radius: 14px;
    border: 1px solid #2563eb;
    background: #2563eb;
    color: white;
    text-decoration: none;
    font-size: 13px;
    font-weight: 850;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 5px 15px rgba(37, 99, 235, 0.11);
    transition: transform 160ms ease, background 160ms ease, box-shadow 160ms ease;
  }

  .t2t-price-card a:hover {
    transform: translateY(-1px);
    background: #1e40af;
    box-shadow: 0 8px 20px rgba(37, 99, 235, 0.15);
  }

  .t2t-price-helper {
    margin: 10px 0 0;
    color: #64748b;
    font-size: 11.5px;
    line-height: 1.5;
    font-weight: 700;
    text-align: center;
  }

  main .t2t-footer {
    margin-top: 68px;
    border-top-color: rgba(226, 232, 240, 0.58);
    background: rgba(255, 255, 255, 0.92);
  }

  main .t2t-footer .t2t-footer-inner {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.95fr);
    gap: 64px;
    padding: 42px 4px 36px;
  }

  main .t2t-footer .t2t-footer-brand {
    max-width: 370px;
  }

  main .t2t-footer .t2t-footer-brand p {
    margin-top: 17px;
    color: #64748b;
    font-weight: 560;
  }

  main .t2t-footer .t2t-footer-support {
    margin-top: 21px;
  }

  main .t2t-footer .t2t-footer-support span {
    color: #94a3b8;
    font-weight: 800;
  }

  main .t2t-footer .t2t-footer-support strong {
    color: #2563eb;
    font-weight: 750;
    transition: color 160ms ease;
  }

  main .t2t-footer .t2t-footer-support:hover strong {
    color: #1d4ed8;
  }

  main .t2t-footer .t2t-footer-nav {
    gap: 36px;
    padding-top: 5px;
  }

  main .t2t-footer .t2t-footer-column h3 {
    margin-bottom: 16px;
    color: #334155;
    font-weight: 750;
  }

  main .t2t-footer .t2t-footer-column div {
    gap: 11px;
  }

  main .t2t-footer .t2t-footer-column a {
    color: #64748b;
    font-weight: 560;
  }

  main .t2t-footer .t2t-footer-column a:hover {
    color: #1d4ed8;
  }

  main .t2t-footer .t2t-footer-bottom {
    border-top-color: rgba(226, 232, 240, 0.58);
    padding: 20px 4px;
    color: #94a3b8;
    font-weight: 560;
  }

  main .t2t-footer .t2t-footer-bottom div {
    gap: 11px;
  }

  main .t2t-footer .t2t-footer-bottom a {
    color: #64748b;
    font-weight: 650;
  }

  main .t2t-footer .t2t-footer-bottom a:hover {
    color: #1d4ed8;
  }

  main .t2t-footer .t2t-footer-bottom div span {
    color: #cbd5e1;
  }

  @media (max-width: 980px) {
    .t2t-nav {
      display: none;
    }

    .t2t-hero {
      grid-template-columns: 1fr;
      grid-template-areas:
        "copy"
        "visual"
        "actions";
      gap: 0;
      padding: 52px 0 38px;
      text-align: center;
    }

    .t2t-hero-copy {
      max-width: 760px;
      margin: 0 auto;
      align-items: center;
    }

    .t2t-hero-copy p {
      margin-left: auto;
      margin-right: auto;
    }

    .t2t-hero-visual {
      width: min(720px, 100%);
      margin: 34px auto 0;
      justify-self: center;
      transform: none;
    }

    .t2t-hero-visual:hover {
      transform: translateY(-2px);
    }

    .t2t-actions {
      margin-top: 24px;
      justify-content: center;
      align-self: auto;
    }

    .t2t-hero-auth-helper {
      text-align: center;
    }

    .t2t-hero-line {
      white-space: normal;
    }

    .t2t-transform-section .t2t-section-heading {
      max-width: 760px;
      margin-left: auto;
      margin-right: auto;
      text-align: center;
    }

    .t2t-transform-section .t2t-section-heading h2,
    .t2t-transform-section .t2t-section-heading p {
      margin-left: auto;
      margin-right: auto;
    }

    .t2t-demo-section .t2t-section-heading {
      max-width: 760px;
      margin-left: auto;
      margin-right: auto;
      text-align: center;
    }

    .t2t-demo-section .t2t-section-heading h2,
    .t2t-demo-section .t2t-section-heading p {
      margin-left: auto;
      margin-right: auto;
    }

    .t2t-workspace .t2t-section-heading {
      max-width: 760px;
      margin-left: auto;
      margin-right: auto;
      text-align: center;
    }

    .t2t-workspace .t2t-section-heading h2,
    .t2t-workspace .t2t-section-heading p {
      margin-left: auto;
      margin-right: auto;
    }

    .t2t-pricing .t2t-section-heading {
      max-width: 760px;
      margin-left: auto;
      margin-right: auto;
      text-align: center;
    }

    .t2t-pricing .t2t-section-heading h2 {
      margin-left: auto;
      margin-right: auto;
    }

    .t2t-workspace {
      padding-top: 52px;
    }

    .t2t-workspace-heading-break {
      display: none;
    }

    .t2t-customer-stories-intro {
      max-width: 760px;
      margin-left: auto;
      margin-right: auto;
      margin-bottom: 48px;
      text-align: center;
    }

    .t2t-customer-stories-intro p {
      margin-left: auto;
      margin-right: auto;
    }

    .t2t-customer-stories-wrap .t2t-customer-stories-grid {
      gap: 20px;
      margin-left: auto;
      margin-right: auto;
    }

    .t2t-demo-grid {
      margin-top: 36px;
      margin-left: auto;
      margin-right: auto;
      gap: 30px;
    }

    .t2t-demo-section {
      padding-top: 52px;
    }

    .t2t-pricing {
      padding-top: 72px;
    }

    .t2t-pricing-grid {
      margin-top: 48px;
    }

    main .t2t-footer .t2t-footer-inner {
      grid-template-columns: 1fr;
      gap: 42px;
    }

    main .t2t-footer .t2t-footer-nav {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 34px 28px;
    }

    .t2t-proof-flow,
    .t2t-demo-grid,
    .t2t-pricing-grid {
      grid-template-columns: 1fr;
    }

    .t2t-proof-flow {
      gap: 36px;
      margin-top: 18px;
      padding: 8px 0;
    }

    .t2t-transform-cta-row {
      margin-top: 28px;
    }

    .t2t-proof-connector {
      display: none;
    }

    .t2t-proof-image img {
      height: 300px;
    }

    .t2t-workspace-premium {
      min-height: auto;
      display: grid;
      gap: 20px;
      margin-top: 34px;
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

  }

  @media (max-width: 640px) {
    .t2t-header,
    .t2t-main {
      width: min(100% - 24px, 1180px);
    }

    .t2t-header {
      padding-top: 14px;
      gap: 12px;
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
      font-size: clamp(29px, 8.4vw, 34px);
      line-height: 1.12;
      letter-spacing: -0.045em;
    }

    .t2t-hero-copy p {
      margin-top: 22px;
      font-size: 16px;
      line-height: 1.55;
    }

    .t2t-actions {
      width: 100%;
      margin-top: 20px;
      gap: 10px;
    }

    .t2t-hero-visual {
      margin-top: 26px;
      border-radius: 13px;
      box-shadow: 0 7px 22px rgba(15, 23, 42, 0.05);
    }

    .t2t-primary,
    .t2t-secondary {
      width: 100%;
    }

    .t2t-section-heading h2 {
      font-size: 30px;
    }

    .t2t-transform-section,
    .t2t-demo-section,
    .t2t-workspace,
    .t2t-pricing {
      padding: 30px 0;
    }

    .t2t-demo-section {
      padding-top: 42px;
    }

    .t2t-workspace {
      padding-top: 44px;
    }

    .t2t-pricing {
      padding-top: 54px;
    }

    .t2t-pricing-grid {
      margin-top: 44px;
    }

    main .t2t-footer {
      margin-top: 50px;
    }

    main .t2t-footer .t2t-footer-inner {
      padding: 32px 0;
      gap: 34px;
    }

    main .t2t-footer .t2t-footer-nav {
      gap: 30px 20px;
    }

    main .t2t-footer .t2t-footer-bottom {
      padding: 22px 0;
      gap: 16px;
    }

    .t2t-proof-image img,
    .t2t-workspace-main-preview img,
    .t2t-workspace-floating-preview img {
      height: 260px;
    }

    .t2t-workspace-floating-preview div {
      padding-right: 0;
    }

    .t2t-demo-grid {
      margin-top: 32px;
      gap: 26px;
      padding: 0;
    }

    .t2t-proof-flow {
      gap: 32px;
      margin-top: 16px;
      padding: 6px 0;
    }

    .t2t-transform-cta-row {
      margin-top: 26px;
    }

    .t2t-workspace-premium {
      gap: 18px;
      margin-top: 30px;
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

    .t2t-customer-stories-wrap {
      padding: 28px 0 30px;
    }

    .t2t-customer-stories-intro {
      margin-bottom: 44px;
    }

    .t2t-customer-stories-wrap .t2t-customer-stories-grid {
      gap: 20px;
    }

    .t2t-customer-stories-intro h2 {
      font-size: 28px;
    }
  }
`;
