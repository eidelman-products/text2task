import Image from "next/image";
import Link from "next/link";

const features = [
  {
    icon: "✦",
    title: "AI extraction",
    text: "Extract tasks, budgets, deadlines, client details, and notes.",
  },
  {
    icon: "✎",
    title: "Review before saving",
    text: "Edit the AI draft before anything is saved.",
  },
  {
    icon: "▣",
    title: "Task CRM",
    text: "Manage client projects, subtasks, deadlines, and status.",
  },
  {
    icon: "⚑",
    title: "Urgent board",
    text: "See what needs attention before deadlines slip.",
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
            <div className="t2t-pill">
              <span />
              AI task CRM for freelancers and small teams
            </div>

            <h1>
              See the chaos.
              <br />
              Get it <span>organized.</span>
            </h1>

            <p>
              Text2Task turns messy client messages into clean projects with
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

          <div className="t2t-hero-proof">
            <div className="t2t-proof-card">
              <span className="t2t-proof-label">What Text2Task does</span>
              <h2>From messy request to ready-to-work project.</h2>
              <p>
                Paste a WhatsApp message, email, note, or screenshot. Review the
                AI draft before anything is saved.
              </p>

              <div className="t2t-proof-points">
                <span>✓ Tasks</span>
                <span>✓ Budget</span>
                <span>✓ Deadline</span>
                <span>✓ Client details</span>
              </div>
            </div>
          </div>
        </section>

        <section className="t2t-transform-section">
          <div className="t2t-transform-heading">
            <div className="t2t-section-kicker">Request to project</div>
            <h2>One messy client message becomes organized work.</h2>
          </div>

          <div className="t2t-transform-grid">
            <div className="t2t-transform-card">
              <div className="t2t-card-label green">Messy client message</div>
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

            <div className="t2t-arrow-wrap" aria-hidden="true">
              <div className="t2t-arrow-circle">
                <svg
                  viewBox="0 0 120 120"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M24 62C24 41.0132 41.0132 24 62 24C78.4972 24 92.5351 34.515 97.7792 49.2097"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M96 30V52H74"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M96 58C96 78.9868 78.9868 96 58 96C41.5028 96 27.4649 85.485 22.2208 70.7903"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M24 90V68H46"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p>AI extracts the work</p>
            </div>

            <div className="t2t-transform-card result">
              <div className="t2t-card-label purple">Clean project draft</div>
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

        <section id="features" className="t2t-features">
          <div className="t2t-section-kicker">Core features</div>

          <div className="t2t-feature-grid">
            {features.map((feature) => (
              <div className="t2t-feature-card" key={feature.title}>
                <div className="t2t-feature-icon">{feature.icon}</div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
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
            />

            <ProductCard
              title="Urgent Tasks Board"
              text="See what needs attention now."
              image="/landing/text2task-urgent-board.png"
              alt="Text2Task urgent tasks board"
            />
          </div>
        </section>

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
}: {
  title: string;
  text: string;
  image: string;
  alt: string;
}) {
  return (
    <div className="t2t-product-card">
      <div className="t2t-product-head">
        <h3>{title}</h3>
        <p>{text}</p>
      </div>

      <div className="t2t-product-image">
        <Image src={image} alt={alt} width={1000} height={560} />
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
    display: grid;
    grid-template-columns: 0.95fr 1.05fr;
    gap: 48px;
    align-items: center;
    padding: 58px 0 34px;
  }

  .t2t-hero-copy {
    max-width: 560px;
  }

  .t2t-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 32px;
    padding: 0 13px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.78);
    color: #4f46e5;
    border: 1px solid #ddd6fe;
    font-size: 12px;
    font-weight: 900;
    box-shadow: 0 12px 30px rgba(79, 70, 229, 0.07);
    backdrop-filter: blur(14px);
  }

  .t2t-pill span {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #22c55e;
    box-shadow: 0 0 0 5px rgba(34, 197, 94, 0.12);
  }

  .t2t-hero h1 {
    margin: 22px 0 0;
    font-size: clamp(48px, 5.1vw, 70px);
    line-height: 0.96;
    letter-spacing: -0.072em;
    font-weight: 950;
  }

  .t2t-hero h1 span {
    color: #4f46e5;
  }

  .t2t-hero-copy p {
    margin: 20px 0 0;
    font-size: 16px;
    line-height: 1.72;
    color: #475569;
    max-width: 480px;
    font-weight: 560;
  }

  .t2t-actions {
    margin-top: 26px;
    display: flex;
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

  .t2t-hero-proof {
    display: flex;
    justify-content: flex-end;
  }

  .t2t-proof-card {
    width: min(100%, 470px);
    border-radius: 30px;
    border: 1px solid rgba(226, 232, 240, 0.95);
    background:
      radial-gradient(circle at top right, rgba(99,102,241,0.14), transparent 38%),
      rgba(255,255,255,0.82);
    padding: 30px;
    box-shadow: 0 24px 70px rgba(15,23,42,0.075);
    backdrop-filter: blur(18px);
  }

  .t2t-proof-label {
    display: inline-flex;
    border-radius: 999px;
    background: #eef2ff;
    color: #4f46e5;
    padding: 8px 12px;
    font-size: 11px;
    font-weight: 950;
    text-transform: uppercase;
    letter-spacing: 0.15em;
  }

  .t2t-proof-card h2 {
    margin: 18px 0 0;
    font-size: 30px;
    line-height: 1.08;
    letter-spacing: -0.05em;
    font-weight: 950;
  }

  .t2t-proof-card p {
    margin: 14px 0 0;
    color: #64748b;
    font-size: 14px;
    line-height: 1.7;
    font-weight: 650;
  }

  .t2t-proof-points {
    margin-top: 20px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .t2t-proof-points span {
    border-radius: 999px;
    background: white;
    border: 1px solid #e2e8f0;
    padding: 8px 10px;
    color: #334155;
    font-size: 12px;
    font-weight: 900;
    box-shadow: 0 10px 24px rgba(15,23,42,0.035);
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

  .t2t-transform-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.82fr) 120px minmax(0, 1.18fr);
    gap: 20px;
    align-items: center;
  }

  .t2t-transform-card {
    border: 1px solid rgba(226, 232, 240, 0.96);
    background: rgba(255, 255, 255, 0.92);
    border-radius: 28px;
    padding: 14px;
    box-shadow:
      0 24px 65px rgba(15, 23, 42, 0.10),
      inset 0 1px 0 rgba(255,255,255,0.9);
    backdrop-filter: blur(16px);
  }

  .t2t-transform-card.result {
    box-shadow:
      0 28px 78px rgba(79, 70, 229, 0.15),
      inset 0 1px 0 rgba(255,255,255,0.9);
  }

  .t2t-card-label {
    display: inline-flex;
    align-items: center;
    height: 27px;
    padding: 0 10px;
    border-radius: 999px;
    font-size: 11px;
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
    height: 290px;
  }

  .t2t-transform-image.preview img {
    height: 290px;
  }

  .t2t-arrow-wrap {
    display: grid;
    justify-items: center;
    gap: 10px;
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
    width: 42px;
    height: 42px;
  }

  .t2t-arrow-wrap p {
    margin: 0;
    max-width: 110px;
    text-align: center;
    color: #475569;
    font-size: 12px;
    line-height: 1.35;
    font-weight: 950;
  }

  .t2t-demo-section,
  .t2t-features,
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

  .t2t-feature-grid {
    margin-top: 22px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 18px;
  }

  .t2t-feature-card {
    background: rgba(255,255,255,0.9);
    border: 1px solid #e2e8f0;
    border-radius: 24px;
    padding: 22px;
    box-shadow: 0 16px 48px rgba(15, 23, 42, 0.05);
    transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
  }

  .t2t-feature-card:hover {
    transform: translateY(-2px);
    border-color: #c7d2fe;
    box-shadow: 0 24px 58px rgba(79, 70, 229, 0.10);
  }

  .t2t-feature-icon {
    width: 42px;
    height: 42px;
    border-radius: 16px;
    background: linear-gradient(135deg, #eef2ff, #f5f3ff);
    color: #4f46e5;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 950;
  }

  .t2t-feature-card h3 {
    margin: 16px 0 0;
    font-size: 16px;
    font-weight: 950;
    letter-spacing: -0.03em;
  }

  .t2t-feature-card p {
    margin: 10px 0 0;
    color: #64748b;
    font-size: 13px;
    line-height: 1.6;
  }

  .t2t-workspace-grid {
    margin-top: 22px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 22px;
  }

  .t2t-product-card {
    background: rgba(255,255,255,0.92);
    border: 1px solid #e2e8f0;
    border-radius: 26px;
    padding: 18px;
    box-shadow: 0 18px 56px rgba(15, 23, 42, 0.055);
  }

  .t2t-product-head h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 950;
    letter-spacing: -0.03em;
  }

  .t2t-product-head p {
    margin: 4px 0 14px;
    color: #64748b;
    font-size: 13px;
  }

  .t2t-product-image {
    overflow: hidden;
    border-radius: 19px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
  }

  .t2t-product-image img {
    display: block;
    width: 100%;
    height: 196px;
    object-fit: contain;
    object-position: center;
    background: #f8fafc;
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
    background: rgba(255,255,255,0.95);
    border: 1px solid #e2e8f0;
    border-radius: 26px;
    padding: 26px;
    box-shadow: 0 18px 56px rgba(15, 23, 42, 0.055);
  }

  .t2t-price-card.popular {
    border-color: #c4b5fd;
    box-shadow: 0 24px 68px rgba(79, 70, 229, 0.12);
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
    box-shadow: 0 14px 30px rgba(79, 70, 229, 0.2);
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
      grid-template-columns: 1fr;
      padding-top: 34px;
    }

    .t2t-hero-copy,
    .t2t-proof-card {
      max-width: 680px;
    }

    .t2t-hero-proof {
      justify-content: flex-start;
    }

    .t2t-transform-grid {
      grid-template-columns: 1fr;
    }

    .t2t-arrow-wrap {
      transform: rotate(90deg);
      margin: -6px 0;
    }

    .t2t-arrow-wrap p {
      display: none;
    }

    .t2t-transform-image.whatsapp img,
    .t2t-transform-image.preview img {
      height: 250px;
    }

    .t2t-demo-grid,
    .t2t-workspace-grid,
    .t2t-pricing-grid {
      grid-template-columns: 1fr;
    }

    .t2t-feature-grid {
      grid-template-columns: repeat(2, 1fr);
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
      font-size: 42px;
    }

    .t2t-hero-copy p {
      font-size: 15px;
    }

    .t2t-proof-card {
      padding: 22px;
    }

    .t2t-proof-card h2 {
      font-size: 25px;
    }

    .t2t-transform-heading h2 {
      font-size: 28px;
    }

    .t2t-feature-grid {
      grid-template-columns: 1fr;
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