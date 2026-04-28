import Link from "next/link";
import LandingFooter from "./landing-footer";
import type React from "react";

export default function HeroSection() {
  return (
    <section style={pageStyle}>
      <style>{responsiveCss}</style>

      <div className="landing-container" style={containerStyle}>
        <header className="landing-header" style={headerStyle}>
          <Link href="/" style={brandStyle}>
            <span style={brandDotStyle} />
            <span>Text2Task</span>
          </Link>

          <nav className="landing-nav" style={navStyle}>
            <a href="#product" style={navLinkStyle}>
              Product
            </a>
            <a href="#features" style={navLinkStyle}>
              Features
            </a>
            <a href="#pricing" style={navLinkStyle}>
              Pricing
            </a>
            <Link href="/login" style={navLinkStyle}>
              Log in
            </Link>
            <Link href="/signup" style={navButtonStyle}>
              Start free
            </Link>
          </nav>
        </header>

        <main className="hero-grid" style={heroGridStyle}>
          <div style={heroCopyStyle}>
            <div className="eyebrow" style={eyebrowStyle}>
              AI CRM for freelancers, creators, and small teams
            </div>

            <h1 className="hero-title" style={h1Style}>
              Turn messy client messages into clear, structured work.
            </h1>

            <p className="hero-lead" style={leadStyle}>
              Text2Task extracts clients, tasks, budgets, deadlines, contact
              details, and priorities from text or screenshots — then organizes
              everything into a clean CRM-style workspace.
            </p>

            <div className="cta-row" style={ctaRowStyle}>
              <Link href="/signup" style={primaryButtonStyle}>
                Start free — 30 extracts
              </Link>
              <a href="#product" style={secondaryButtonStyle}>
                See how it works
              </a>
            </div>

            <div className="trust-row" style={trustRowStyle}>
              <span>✓ No credit card required</span>
              <span>✓ Text + image extraction</span>
              <span>✓ Built for real client work</span>
            </div>
          </div>

          <div className="hero-mockup" style={heroMockupStyle}>
            <div style={mockupTopBarStyle}>
              <span style={mockupDotGreenStyle} />
              AI extraction preview
            </div>

            <div style={messageCardStyle}>
              <div style={miniLabelStyle}>Client message</div>
              <p style={messageTextStyle}>
                “Hey, I need a landing page and logo for Brightside Dental.
                Budget is around $1,200. Can you finish by next Friday? You can
                reach me at sarah@brightside.com or 212-555-8912.”
              </p>
            </div>

            <div style={conversionLineStyle}>
              <span style={conversionIconStyle}>AI</span>
              <span>
                Extracting client, task, budget, deadline, and contact info...
              </span>
            </div>

            <div className="extracted-grid" style={extractedGridStyle}>
              <DataChip label="Client" value="Sarah Mitchell" />
              <DataChip label="Company" value="Brightside Dental" />
              <DataChip label="Tasks" value="Landing page + Logo" />
              <DataChip label="Budget" value="$1,200" />
              <DataChip label="Deadline" value="Next Friday" />
              <DataChip label="Phone" value="212-555-8912" />
              <DataChip label="Email" value="sarah@brightside.com" wide />
            </div>

            <div style={saveBarStyle}>
              <span>Ready to save into CRM</span>
              <span style={saveButtonFakeStyle}>Save task</span>
            </div>
          </div>
        </main>

        <section id="product" style={productSectionStyle}>
          <SectionTitle
            kicker="Product workflow"
            title="From messy input to a clear business workspace."
            text="Text2Task is built around one simple flow: capture the request, extract the important details, and manage the work in one place."
          />

          <div className="workflow-grid" style={workflowGridStyle}>
            <WorkflowCard
              number="01"
              title="Extract from text or screenshots"
              text="Paste a WhatsApp message, email, DM, client note, or upload a screenshot."
            >
              <ExtractionMockup />
            </WorkflowCard>

            <WorkflowCard
              number="02"
              title="Review structured tasks"
              text="Edit the extracted client, task, amount, deadline, and priority before saving."
            >
              <CrmTableMockup />
            </WorkflowCard>

            <WorkflowCard
              number="03"
              title="Track work and revenue"
              text="See open tasks, urgent work, monthly income, clients, and task types."
            >
              <AnalyticsMockup />
            </WorkflowCard>
          </div>
        </section>

        <section id="features" style={featuresSectionStyle}>
          <SectionTitle
            kicker="Why Text2Task"
            title="Built for real client work, not just notes."
            text="Most tools store information. Text2Task helps turn unstructured messages into work you can actually manage."
          />

          <div className="feature-grid" style={featureGridStyle}>
            <FeatureItem
              title="Text extraction"
              text="Paste messy messages and get structured tasks instantly."
            />
            <FeatureItem
              title="Image extraction"
              text="Upload screenshots and extract visible client requests."
            />
            <FeatureItem
              title="Editable preview"
              text="Review, correct, and approve tasks before saving."
            />
            <FeatureItem
              title="CRM task workspace"
              text="Keep client work organized by client, amount, deadline, and status."
            />
            <FeatureItem
              title="Revenue visibility"
              text="Track income by client, month, and task type."
            />
            <FeatureItem
              title="CSV export"
              text="Export your task data with the Pro plan."
            />
          </div>
        </section>

        <section id="pricing" style={pricingSectionStyle}>
          <SectionTitle
            kicker="Pricing"
            title="Simple pricing for a simple workflow."
            text="Start free with 30 total extracts. Upgrade when Text2Task becomes part of your daily work."
          />

          <div className="pricing-grid" style={pricingGridStyle}>
            <PricingCard
              name="Free"
              price="$0"
              description="For trying Text2Task with real client messages."
              features={[
                "30 total AI extracts",
                "Text and image extraction",
                "Save to tasks",
                "Dashboard and task workspace",
                "CSV export not included",
              ]}
              buttonText="Start free"
              href="/signup"
              highlighted={false}
            />

            <PricingCard
              name="Pro"
              price="$12.90"
              suffix="/ month"
              description="For freelancers and small teams using Text2Task every day."
              features={[
                "Unlimited AI extracts",
                "Unlimited saved tasks",
                "CSV export",
                "Dashboard analytics",
                "Future Pro features included",
              ]}
              buttonText="Upgrade to Pro"
              href="/signup"
              highlighted
            />
          </div>
        </section>

        <section className="final-cta" style={finalCtaStyle}>
          <div>
            <div className="final-title" style={finalTitleStyle}>
              Ready to organize your next client request?
            </div>
            <div style={finalTextStyle}>
              Start free and turn messy messages into structured work in
              seconds.
            </div>
          </div>

          <Link href="/signup" style={finalButtonStyle}>
            Start free
          </Link>
        </section>

        <LandingFooter />
      </div>
    </section>
  );
}

function SectionTitle({
  kicker,
  title,
  text,
}: {
  kicker: string;
  title: string;
  text: string;
}) {
  return (
    <div style={sectionTitleStyle}>
      <div style={kickerStyle}>{kicker}</div>
      <h2 className="section-title" style={h2Style}>
        {title}
      </h2>
      <p style={sectionTextStyle}>{text}</p>
    </div>
  );
}

function DataChip({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "data-chip-wide" : ""} style={dataChipStyle}>
      <span style={dataChipLabelStyle}>{label}</span>
      <span style={dataChipValueStyle}>{value}</span>
    </div>
  );
}

function WorkflowCard({
  number,
  title,
  text,
  children,
}: {
  number: string;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div style={workflowCardStyle}>
      <div style={workflowTopStyle}>
        <span style={workflowNumberStyle}>{number}</span>
        <div>
          <div style={workflowTitleStyle}>{title}</div>
          <div style={workflowTextStyle}>{text}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function ExtractionMockup() {
  return (
    <div style={smallMockupStyle}>
      <div style={smallMockupLabelStyle}>Input</div>
      <div style={smallInputStyle}>
        “Need a homepage refresh for Apex Roofing. Budget $950. Deadline May
        10.”
      </div>
      <div style={smallArrowStyle}>↓</div>
      <div style={smallOutputStyle}>
        <span>Homepage refresh</span>
        <span>$950</span>
      </div>
    </div>
  );
}

function CrmTableMockup() {
  return (
    <div style={tableMockupStyle}>
      <div style={tableHeaderStyle}>
        <span>Client</span>
        <span>Task</span>
        <span>Due</span>
      </div>
      <div style={tableRowStyle}>
        <span>Brightside</span>
        <strong>Landing page</strong>
        <span>Friday</span>
      </div>
      <div style={tableRowStyle}>
        <span>Apex</span>
        <strong>Homepage</strong>
        <span>May 10</span>
      </div>
      <div style={tableRowStyle}>
        <span>Northline</span>
        <strong>Email</strong>
        <span>Soon</span>
      </div>
    </div>
  );
}

function AnalyticsMockup() {
  return (
    <div style={analyticsMockupStyle}>
      <div style={analyticsTopStyle}>
        <div>
          <div style={analyticsLabelStyle}>This month</div>
          <div style={analyticsMoneyStyle}>$4,800</div>
        </div>
        <div style={analyticsBadgeStyle}>+24%</div>
      </div>

      <div style={barChartStyle}>
        <span style={{ height: "42%", background: "#93c5fd" }} />
        <span style={{ height: "64%", background: "#818cf8" }} />
        <span style={{ height: "52%", background: "#a78bfa" }} />
        <span style={{ height: "86%", background: "#22c55e" }} />
      </div>

      <div style={analyticsListStyle}>
        <div>
          <span>Open tasks</span>
          <strong>18</strong>
        </div>
        <div>
          <span>Active clients</span>
          <strong>7</strong>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({ title, text }: { title: string; text: string }) {
  return (
    <div style={featureItemStyle}>
      <div style={checkCircleStyle}>✓</div>
      <div>
        <div style={featureTitleStyle}>{title}</div>
        <div style={featureTextStyle}>{text}</div>
      </div>
    </div>
  );
}

function PricingCard({
  name,
  price,
  suffix,
  description,
  features,
  buttonText,
  href,
  highlighted,
}: {
  name: string;
  price: string;
  suffix?: string;
  description: string;
  features: string[];
  buttonText: string;
  href: string;
  highlighted: boolean;
}) {
  return (
    <div
      style={{
        ...pricingCardStyle,
        border: highlighted
          ? "1px solid rgba(99,102,241,0.36)"
          : "1px solid rgba(226,232,240,0.96)",
        boxShadow: highlighted
          ? "0 28px 70px rgba(79,70,229,0.16)"
          : "0 18px 44px rgba(15,23,42,0.06)",
      }}
    >
      {highlighted ? <div style={popularBadgeStyle}>Best value</div> : null}

      <div style={pricingNameStyle}>{name}</div>

      <div style={pricingPriceStyle}>
        {price}
        {suffix ? <span style={pricingSuffixStyle}>{suffix}</span> : null}
      </div>

      <p style={pricingDescriptionStyle}>{description}</p>

      <div style={pricingFeaturesStyle}>
        {features.map((feature) => (
          <div key={feature} style={pricingFeatureStyle}>
            <span style={pricingCheckStyle}>✓</span>
            {feature}
          </div>
        ))}
      </div>

      <Link
        href={href}
        style={{
          ...pricingButtonStyle,
          background: highlighted ? "#4f46e5" : "#0f172a",
        }}
      >
        {buttonText}
      </Link>
    </div>
  );
}

const responsiveCss = `
  .data-chip-wide {
    grid-column: 1 / -1;
  }

  .bar-chart-span {
    width: 100%;
  }

  @media (max-width: 900px) {
    .landing-container {
      gap: 64px !important;
    }

    .hero-grid {
      grid-template-columns: 1fr !important;
      gap: 30px !important;
    }

    .hero-mockup {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }

    .workflow-grid,
    .pricing-grid {
      grid-template-columns: 1fr !important;
    }

    .feature-grid {
      grid-template-columns: 1fr 1fr !important;
    }
  }

  @media (max-width: 520px) {
    .landing-container {
      gap: 54px !important;
    }

    .landing-header {
      align-items: flex-start !important;
      gap: 18px !important;
    }

    .landing-nav {
      width: 100% !important;
      display: grid !important;
      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      gap: 8px !important;
    }

    .landing-nav a {
      text-align: center !important;
      padding: 10px 6px !important;
      font-size: 12px !important;
      border-radius: 12px !important;
    }

    .landing-nav a:last-child {
      grid-column: 1 / -1 !important;
      min-height: 44px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 13px !important;
    }

    .hero-grid {
      gap: 26px !important;
    }

    .eyebrow {
      font-size: 12px !important;
      line-height: 1.35 !important;
      max-width: 100% !important;
    }

    .hero-title {
      font-size: 42px !important;
      line-height: 1.04 !important;
      letter-spacing: -0.055em !important;
    }

    .hero-lead {
      font-size: 15.5px !important;
      line-height: 1.72 !important;
    }

    .cta-row {
      display: grid !important;
      grid-template-columns: 1fr !important;
      width: 100% !important;
    }

    .cta-row a {
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .trust-row {
      display: grid !important;
      gap: 8px !important;
      font-size: 13px !important;
    }

    .hero-mockup {
      padding: 16px !important;
      border-radius: 24px !important;
    }

    .extracted-grid {
      grid-template-columns: 1fr !important;
    }

    .section-title {
      font-size: 30px !important;
      line-height: 1.12 !important;
    }

    .workflow-grid,
    .feature-grid,
    .pricing-grid {
      grid-template-columns: 1fr !important;
    }

    .final-cta {
      padding: 24px !important;
      border-radius: 26px !important;
    }

    .final-title {
      font-size: 25px !important;
    }

    .final-cta a {
      width: 100% !important;
      box-sizing: border-box !important;
    }
  }
`;

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "24px",
};

const containerStyle: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
  display: "grid",
  gap: 86,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 18,
  flexWrap: "wrap",
};

const brandStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 12,
  color: "#0f172a",
  fontSize: 22,
  fontWeight: 900,
  letterSpacing: "-0.04em",
  textDecoration: "none",
};

const brandDotStyle: React.CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: 999,
  background: "linear-gradient(135deg, #60a5fa, #6366f1, #8b5cf6)",
  boxShadow: "0 0 0 8px rgba(99,102,241,0.10)",
};

const navStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const navLinkStyle: React.CSSProperties = {
  color: "#334155",
  fontSize: 14,
  fontWeight: 800,
  textDecoration: "none",
  padding: "10px 12px",
};

const navButtonStyle: React.CSSProperties = {
  color: "#ffffff",
  background: "#0f172a",
  fontSize: 14,
  fontWeight: 900,
  textDecoration: "none",
  padding: "12px 16px",
  borderRadius: 14,
  boxShadow: "0 14px 28px rgba(15,23,42,0.14)",
};

const heroGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.03fr) minmax(360px, 0.97fr)",
  gap: 46,
  alignItems: "center",
};

const heroCopyStyle: React.CSSProperties = {
  display: "grid",
  gap: 22,
};

const eyebrowStyle: React.CSSProperties = {
  width: "fit-content",
  padding: "8px 14px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.86)",
  border: "1px solid rgba(99,102,241,0.16)",
  color: "#4f46e5",
  fontSize: 14,
  fontWeight: 850,
  boxShadow: "0 10px 24px rgba(15,23,42,0.04)",
};

const h1Style: React.CSSProperties = {
  margin: 0,
  fontSize: "clamp(46px, 5.7vw, 68px)",
  lineHeight: 1.12,
  letterSpacing: "-0.045em",
  fontWeight: 760,
  color: "#111827",
  maxWidth: 760,
};

const leadStyle: React.CSSProperties = {
  margin: 0,
  color: "#334155",
  fontSize: 18,
  lineHeight: 1.75,
  maxWidth: 690,
};

const ctaRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 14,
  flexWrap: "wrap",
  alignItems: "center",
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 54,
  padding: "0 24px",
  borderRadius: 16,
  background: "#0f172a",
  color: "#ffffff",
  fontSize: 16,
  fontWeight: 900,
  textDecoration: "none",
  boxShadow: "0 18px 34px rgba(15,23,42,0.16)",
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 54,
  padding: "0 24px",
  borderRadius: 16,
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 16,
  fontWeight: 850,
  textDecoration: "none",
  border: "1px solid #cbd5e1",
  boxShadow: "0 12px 26px rgba(15,23,42,0.06)",
};

const trustRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  color: "#475569",
  fontSize: 14,
  fontWeight: 700,
};

const heroMockupStyle: React.CSSProperties = {
  borderRadius: 30,
  padding: 22,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(239,246,255,0.72))",
  border: "1px solid rgba(191,219,254,0.96)",
  boxShadow:
    "0 30px 70px rgba(37,99,235,0.12), inset 0 1px 0 rgba(255,255,255,0.94)",
  display: "grid",
  gap: 16,
};

const mockupTopBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#0f172a",
  fontSize: 15,
  fontWeight: 900,
};

const mockupDotGreenStyle: React.CSSProperties = {
  width: 10,
  height: 10,
  borderRadius: 999,
  background: "#22c55e",
  boxShadow: "0 0 0 6px rgba(34,197,94,0.12)",
};

const messageCardStyle: React.CSSProperties = {
  borderRadius: 22,
  padding: 18,
  background: "#ffffff",
  border: "1px solid #dbeafe",
};

const miniLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 850,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 8,
};

const messageTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#1e293b",
  fontSize: 15.5,
  lineHeight: 1.85,
};

const conversionLineStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "12px 14px",
  borderRadius: 18,
  background:
    "linear-gradient(90deg, rgba(99,102,241,0.12), rgba(59,130,246,0.08))",
  color: "#4f46e5",
  fontSize: 14,
  fontWeight: 850,
};

const conversionIconStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  background: "#4f46e5",
  color: "#ffffff",
  fontSize: 12,
  fontWeight: 900,
  flexShrink: 0,
};

const extractedGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const dataChipStyle: React.CSSProperties = {
  borderRadius: 18,
  padding: "13px 14px",
  background: "#ffffff",
  border: "1px solid #dbeafe",
  display: "grid",
  gap: 5,
};

const dataChipLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 850,
};

const dataChipValueStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 14.5,
  fontWeight: 850,
  overflowWrap: "anywhere",
};

const saveBarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "13px 14px",
  borderRadius: 18,
  background: "linear-gradient(135deg, #0f172a, #1e1b4b)",
  color: "#ffffff",
  fontSize: 14,
  fontWeight: 850,
};

const saveButtonFakeStyle: React.CSSProperties = {
  padding: "8px 12px",
  borderRadius: 12,
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 900,
  flexShrink: 0,
};

const productSectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 28,
};

const sectionTitleStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  maxWidth: 780,
};

const kickerStyle: React.CSSProperties = {
  color: "#4f46e5",
  fontSize: 13,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.10em",
};

const h2Style: React.CSSProperties = {
  margin: 0,
  color: "#111827",
  fontSize: "clamp(32px, 4vw, 48px)",
  lineHeight: 1.12,
  letterSpacing: "-0.04em",
  fontWeight: 760,
};

const sectionTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 17,
  lineHeight: 1.75,
};

const workflowGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 18,
};

const workflowCardStyle: React.CSSProperties = {
  borderRadius: 28,
  padding: 20,
  background: "rgba(255,255,255,0.92)",
  border: "1px solid rgba(191,219,254,0.80)",
  boxShadow: "0 18px 44px rgba(37,99,235,0.055)",
  display: "grid",
  gap: 18,
};

const workflowTopStyle: React.CSSProperties = {
  display: "flex",
  gap: 14,
  alignItems: "flex-start",
};

const workflowNumberStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 14,
  display: "grid",
  placeItems: "center",
  background: "rgba(99,102,241,0.10)",
  color: "#4f46e5",
  fontSize: 13,
  fontWeight: 900,
  flexShrink: 0,
};

const workflowTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 18,
  fontWeight: 850,
  marginBottom: 6,
};

const workflowTextStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  lineHeight: 1.6,
  fontWeight: 650,
};

const smallMockupStyle: React.CSSProperties = {
  borderRadius: 20,
  padding: 14,
  background: "#eff6ff",
  border: "1px solid #dbeafe",
  display: "grid",
  gap: 10,
};

const smallMockupLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const smallInputStyle: React.CSSProperties = {
  borderRadius: 14,
  padding: 12,
  background: "#ffffff",
  border: "1px solid #dbeafe",
  color: "#334155",
  fontSize: 13,
  lineHeight: 1.5,
};

const smallArrowStyle: React.CSSProperties = {
  color: "#4f46e5",
  textAlign: "center",
  fontWeight: 900,
};

const smallOutputStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  borderRadius: 14,
  padding: 12,
  background: "#ffffff",
  border: "1px solid #dbeafe",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 850,
};

const tableMockupStyle: React.CSSProperties = {
  borderRadius: 20,
  padding: 14,
  background: "#eff6ff",
  border: "1px solid #dbeafe",
  display: "grid",
  gap: 8,
};

const tableHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1.2fr 0.8fr",
  gap: 8,
  color: "#64748b",
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
};

const tableRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1.2fr 0.8fr",
  gap: 8,
  alignItems: "center",
  borderRadius: 14,
  padding: 10,
  background: "#ffffff",
  border: "1px solid #dbeafe",
  color: "#334155",
  fontSize: 12,
  overflowWrap: "anywhere",
};

const analyticsMockupStyle: React.CSSProperties = {
  borderRadius: 20,
  padding: 14,
  background: "#eff6ff",
  border: "1px solid #dbeafe",
  display: "grid",
  gap: 16,
};

const analyticsTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const analyticsLabelStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  fontWeight: 850,
};

const analyticsMoneyStyle: React.CSSProperties = {
  color: "#16a34a",
  fontSize: 28,
  fontWeight: 900,
  letterSpacing: "-0.04em",
};

const analyticsBadgeStyle: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 999,
  background: "#dcfce7",
  color: "#15803d",
  fontSize: 12,
  fontWeight: 900,
};

const barChartStyle: React.CSSProperties = {
  height: 88,
  display: "flex",
  alignItems: "flex-end",
  gap: 10,
};

const analyticsListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const featuresSectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 28,
};

const featureGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
};

const featureItemStyle: React.CSSProperties = {
  display: "flex",
  gap: 14,
  padding: 18,
  borderRadius: 22,
  background: "rgba(255,255,255,0.88)",
  border: "1px solid rgba(191,219,254,0.80)",
  boxShadow: "0 12px 30px rgba(37,99,235,0.04)",
};

const checkCircleStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "#dcfce7",
  color: "#15803d",
  fontWeight: 900,
  flexShrink: 0,
};

const featureTitleStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 16,
  fontWeight: 850,
  marginBottom: 4,
};

const featureTextStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 650,
};

const pricingSectionStyle: React.CSSProperties = {
  display: "grid",
  gap: 28,
};

const pricingGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 20,
};

const pricingCardStyle: React.CSSProperties = {
  position: "relative",
  borderRadius: 30,
  padding: 26,
  background: "rgba(255,255,255,0.94)",
  display: "grid",
  gap: 18,
};

const popularBadgeStyle: React.CSSProperties = {
  position: "absolute",
  top: 18,
  right: 18,
  padding: "7px 11px",
  borderRadius: 999,
  background: "rgba(79,70,229,0.10)",
  color: "#4f46e5",
  fontSize: 12,
  fontWeight: 900,
};

const pricingNameStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 20,
  fontWeight: 900,
};

const pricingPriceStyle: React.CSSProperties = {
  color: "#0f172a",
  fontSize: 42,
  fontWeight: 900,
  letterSpacing: "-0.05em",
};

const pricingSuffixStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 15,
  fontWeight: 800,
  marginLeft: 5,
  letterSpacing: 0,
};

const pricingDescriptionStyle: React.CSSProperties = {
  margin: 0,
  color: "#64748b",
  fontSize: 15,
  lineHeight: 1.65,
  fontWeight: 650,
};

const pricingFeaturesStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const pricingFeatureStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  color: "#334155",
  fontSize: 15,
  fontWeight: 750,
};

const pricingCheckStyle: React.CSSProperties = {
  color: "#16a34a",
  fontWeight: 900,
};

const pricingButtonStyle: React.CSSProperties = {
  marginTop: 4,
  minHeight: 48,
  borderRadius: 15,
  color: "#ffffff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  fontSize: 15,
  fontWeight: 900,
};

const finalCtaStyle: React.CSSProperties = {
  marginBottom: 30,
  borderRadius: 32,
  padding: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 20,
  flexWrap: "wrap",
  background: "linear-gradient(135deg, #0f172a, #1e1b4b)",
  boxShadow: "0 26px 70px rgba(15,23,42,0.18)",
};

const finalTitleStyle: React.CSSProperties = {
  color: "#ffffff",
  fontSize: 28,
  fontWeight: 850,
  letterSpacing: "-0.04em",
  marginBottom: 6,
};

const finalTextStyle: React.CSSProperties = {
  color: "rgba(226,232,240,0.82)",
  fontSize: 15,
  lineHeight: 1.6,
};

const finalButtonStyle: React.CSSProperties = {
  minHeight: 48,
  padding: "0 22px",
  borderRadius: 15,
  background: "#ffffff",
  color: "#0f172a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  fontSize: 15,
  fontWeight: 900,
};