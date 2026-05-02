import Link from "next/link";
import type { CSSProperties } from "react";
import LandingFooter from "./landing-footer";

const audienceCards = [
  {
    title: "Web designers",
    text: "Turn homepage updates, landing pages, pricing edits, and client revisions into clear tasks.",
  },
  {
    title: "Graphic designers",
    text: "Organize logos, banners, revisions, brand assets, and delivery notes from messy requests.",
  },
  {
    title: "Social media managers",
    text: "Extract content requests, campaign notes, deadlines, and approvals from client messages.",
  },
  {
    title: "Video editors",
    text: "Convert feedback, delivery notes, deadlines, and change requests into structured work.",
  },
  {
    title: "Virtual assistants",
    text: "Capture instructions, follow-ups, and admin requests and turn them into organized daily tasks.",
  },
  {
    title: "Small agencies",
    text: "Keep client requests, deliverables, budgets, and workload visible in one shared workspace.",
  },
];

const featureCards = [
  {
    title: "Text extraction",
    text: "Paste messy messages and get structured tasks instantly.",
  },
  {
    title: "Image extraction",
    text: "Upload screenshots and extract visible client requests.",
  },
  {
    title: "Editable preview",
    text: "Review, correct, and approve tasks before saving.",
  },
  {
    title: "Client task workspace",
    text: "Keep client work organized by client, amount, deadline, and status.",
  },
  {
    title: "Revenue visibility",
    text: "Track income by client, month, and task type.",
  },
  {
    title: "CSV export",
    text: "Export your task data with the Pro plan.",
  },
];

const revenueBars = [
  { label: "Jan", value: 45, amount: "$2.8k" },
  { label: "Feb", value: 58, amount: "$3.4k" },
  { label: "Mar", value: 72, amount: "$4.1k" },
  { label: "Apr", value: 84, amount: "$4.8k" },
  { label: "May", value: 68, amount: "$3.9k" },
];

const pipelineRows = [
  { label: "Open tasks", value: "18", tone: "dark" },
  { label: "Due this week", value: "7", tone: "purple" },
  { label: "In review", value: "4", tone: "blue" },
  { label: "Completed this month", value: "26", tone: "green" },
];

const healthRows = [
  { name: "Brightside Dental", amount: "$1,200", due: "Fri", status: "High" },
  { name: "Northline", amount: "$850", due: "Fri", status: "Medium" },
  { name: "Apex Roofing", amount: "$950", due: "May 10", status: "High" },
  { name: "Rivon Media", amount: "$640", due: "Soon", status: "Low" },
];

const inboxItems = [
  {
    sender: "Sarah – Brightside Dental",
    subject: "Landing page + logo + updates",
    preview:
      "Need a landing page, homepage edits, and a quick logo cleanup. Budget is around $1,200...",
    badge: "3 tasks",
    time: "09:14",
  },
  {
    sender: "Mark – Northline",
    subject: "Homepage, pricing section, 3 email templates",
    preview:
      "Can you update the homepage, add a pricing section, and create 3 email templates by next Friday?",
    badge: "Deadline",
    time: "10:26",
  },
  {
    sender: "Lena – Apex Roofing",
    subject: "Please revise the brochure + send invoice",
    preview:
      "Need 2 brochure revisions, invoice update, and final delivery by May 10. Budget is $950.",
    badge: "Budget",
    time: "11:08",
  },
  {
    sender: "Screenshot / WhatsApp",
    subject: "Random notes from client chat",
    preview:
      "Also add CTA button, phone number, testimonial section, and send first draft before weekend.",
    badge: "Notes",
    time: "11:44",
  },
];

const crmRows = [
  {
    client: "Brightside",
    task: "Landing page",
    due: "Fri",
    amount: "$1,200",
    status: "High",
  },
  {
    client: "Brightside",
    task: "Logo cleanup",
    due: "Fri",
    amount: "$250",
    status: "Medium",
  },
  {
    client: "Northline",
    task: "Pricing section",
    due: "Fri",
    amount: "$300",
    status: "Medium",
  },
  {
    client: "Northline",
    task: "3 email templates",
    due: "Fri",
    amount: "$550",
    status: "High",
  },
  {
    client: "Apex Roofing",
    task: "Brochure revisions",
    due: "May 10",
    amount: "$950",
    status: "High",
  },
];

export default function HeroSection() {
  return (
    <div style={shellStyle}>
      <style>{responsiveCss}</style>

      <div className="landing-container" style={containerStyle}>
        <header className="landing-nav-shell" style={navStyle}>
          <Link href="/" style={logoStyle}>
            <span style={logoDotStyle} />
            <span>Text2Task</span>
          </Link>

          <nav className="landing-nav-links" style={navLinksStyle}>
            <Link href="#product" style={navLinkStyle}>
              Product
            </Link>
            <Link href="#features" style={navLinkStyle}>
              Features
            </Link>
            <Link href="#pricing" style={navLinkStyle}>
              Pricing
            </Link>
            <Link href="/login" style={navLinkStyle}>
              Log in
            </Link>
            <Link href="/signup" style={navButtonStyle}>
              Try Text2Task
            </Link>
          </nav>
        </header>

        <section id="product" className="hero-section" style={heroSectionStyle}>
          <div className="hero-left" style={heroLeftStyle}>
            <h1 className="hero-title" style={heroTitleStyle}>
              Paste a messy
              <br />
              client message.
              <br />
              <span style={heroTitleAccentStyle}>Get clean tasks instantly.</span>
            </h1>

            <p className="hero-subtitle" style={heroSubtitleStyle}>
              Text2Task extracts tasks, deadlines, budgets, client details,
              phone numbers, emails, and notes from text or screenshots — then
              organizes everything in one workspace.
            </p>

            <div className="hero-cta-row" style={heroCtaRowStyle}>
              <Link href="/signup" style={primaryButtonStyle}>
                Try Text2Task
              </Link>

              <Link href="#how-it-works" style={secondaryButtonStyle}>
                See how it works
              </Link>
            </div>

            <div className="hero-trust-row" style={heroTrustRowStyle}>
              <span style={trustItemStyle}>✓ Free plan includes 30 total extracts</span>
              <span style={trustItemStyle}>✓ Try with real client messages</span>
              <span style={trustItemStyle}>✓ Text + screenshot extraction</span>
            </div>
          </div>

          <div className="hero-right" style={heroRightStyle}>
            <div className="preview-card" style={previewCardStyle}>
              <div style={previewHeaderStyle}>
                <div style={previewBadgeStyle}>
                  <span style={previewBadgeDotStyle} />
                  AI extraction preview
                </div>
              </div>

              <div style={messageBoxStyle}>
                <div style={messageLabelStyle}>MESSY CLIENT MESSAGE</div>
                <div style={messageTextStyle}>
                  “Hey, I need a landing page and logo for Brightside Dental.
                  Budget is around $1,200. Can you finish by next Friday? You
                  can reach me at sarah@brightside.com or 212-555-8912.”
                </div>
              </div>

              <div style={extractingBarStyle}>
                <div style={extractingIconStyle}>AI</div>
                <div style={extractingTextStyle}>
                  Extracting task, deadline, budget, client details, email, and
                  phone...
                </div>
              </div>

              <div style={infoGridStyle}>
                <InfoCard label="Client" value="Sarah Mitchell" />
                <InfoCard label="Company" value="Brightside Dental" />
                <InfoCard label="Task" value="Landing page + Logo" />
                <InfoCard label="Budget" value="$1,200" />
                <InfoCard label="Deadline" value="Next Friday" />
                <InfoCard label="Phone" value="212-555-8912" />
              </div>

              <div style={emailWideCardStyle}>
                <div style={wideLabelStyle}>Email</div>
                <div style={wideValueStyle}>sarah@brightside.com</div>
              </div>

              <div style={previewFooterStyle}>
                <div style={previewFooterTextStyle}>
                  Ready to save into your workspace
                </div>
                <div style={saveButtonStyle}>Save task</div>
              </div>
            </div>
          </div>
        </section>

        <section style={sectionStyle}>
          <SectionEyebrow>BUILT FOR</SectionEyebrow>
          <h2 className="section-title" style={sectionTitleStyle}>
            Freelancers who manage real client work from messages.
          </h2>
          <p style={sectionTextStyle}>
            Text2Task is made for people who receive work requests through
            WhatsApp, email, screenshots, DMs, and informal notes.
          </p>

          <div className="grid-three" style={cardGridThreeStyle}>
            {audienceCards.map((item) => (
              <div key={item.title} style={audienceCardStyle}>
                <div style={checkBubbleStyle}>✓</div>
                <div>
                  <div style={smallCardTitleStyle}>{item.title}</div>
                  <div style={smallCardTextStyle}>{item.text}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" style={sectionStyle}>
          <SectionEyebrow>BEFORE / AFTER</SectionEyebrow>
          <h2 className="section-title" style={sectionTitleStyle}>
            From a crowded inbox to an organized client workspace.
          </h2>
          <p style={sectionTextStyle}>
            Text2Task reads messy client emails, notes, and screenshots — then
            turns them into clear tasks with clients, deadlines, budgets, and
            priorities.
          </p>

          <div className="before-after-grid" style={beforeAfterGridStyle}>
            <div style={largePanelStyle}>
              <div style={panelTopRowStyle}>
                <div>
                  <div style={panelTagStyle}>BEFORE</div>
                  <div style={panelTitleStyle}>Messy inbox / client requests</div>
                </div>
                <div style={inboxCountStyle}>12 unread</div>
              </div>

              <div style={inboxShellStyle}>
                {inboxItems.map((item) => (
                  <div key={`${item.sender}-${item.subject}`} style={emailRowStyle}>
                    <div style={emailAvatarStyle}>{item.sender.charAt(0)}</div>

                    <div style={emailContentStyle}>
                      <div style={emailTopLineStyle}>
                        <div style={emailSenderStyle}>{item.sender}</div>
                        <div style={emailTimeStyle}>{item.time}</div>
                      </div>

                      <div style={emailSubjectStyle}>{item.subject}</div>
                      <div style={emailPreviewStyle}>{item.preview}</div>
                    </div>

                    <div style={emailBadgeStyle}>{item.badge}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={largePanelStyle}>
              <div style={panelTopRowStyle}>
                <div>
                  <div style={panelTagStyle}>AFTER</div>
                  <div style={panelTitleStyle}>Structured CRM workspace</div>
                </div>
                <div style={workspaceBadgeStyle}>Extracted</div>
              </div>

              <div className="kpi-row" style={workspaceKpiRowStyle}>
                <MiniStatCard label="Open tasks" value="18" />
                <MiniStatCard label="Urgent" value="7" />
                <MiniStatCard label="This month" value="$4,800" />
              </div>

              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={tableHeadStyle}>Client</th>
                      <th style={tableHeadStyle}>Task</th>
                      <th style={tableHeadStyle}>Due</th>
                      <th style={tableHeadStyle}>Amount</th>
                      <th style={tableHeadStyle}>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {crmRows.map((row) => (
                      <tr key={`${row.client}-${row.task}`} style={tableRowStyle}>
                        <td style={tableCellStyle}>{row.client}</td>
                        <td style={tableCellStrongStyle}>{row.task}</td>
                        <td style={tableCellStyle}>{row.due}</td>
                        <td style={tableCellStyle}>{row.amount}</td>
                        <td style={tableCellStyle}>
                          <span style={priorityBadgeStyle(row.status)}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section id="features" style={sectionStyle}>
          <SectionEyebrow>WHY TEXT2TASK</SectionEyebrow>
          <h2 className="section-title" style={sectionTitleStyle}>
            Built for real client work, not just notes.
          </h2>
          <p style={sectionTextStyle}>
            Most tools store information. Text2Task helps turn unstructured
            messages into work you can actually manage.
          </p>

          <div className="grid-two" style={cardGridTwoStyle}>
            {featureCards.map((item) => (
              <div key={item.title} style={featureCardStyle}>
                <div style={checkBubbleStyle}>✓</div>
                <div>
                  <div style={smallCardTitleStyle}>{item.title}</div>
                  <div style={smallCardTextStyle}>{item.text}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={sectionStyle}>
          <SectionEyebrow>ANALYTICS</SectionEyebrow>
          <h2 className="section-title" style={sectionTitleStyle}>
            See revenue, workload, and task health at a glance.
          </h2>
          <p style={sectionTextStyle}>
            After extraction, the value is not only “clean data” — it is also a
            clearer business view: revenue, active work, due dates, and client
            priorities in one place.
          </p>

          <div className="analytics-grid" style={analyticsGridStyle}>
            <div style={analyticsCardStyle}>
              <div style={analyticsHeaderStyle}>
                <div>
                  <div style={analyticsLabelStyle}>Revenue snapshot</div>
                  <div style={analyticsTitleStyle}>Monthly income</div>
                </div>
                <div style={analyticsChipStyle}>+24%</div>
              </div>

              <div style={chartAreaStyle}>
                {revenueBars.map((bar) => (
                  <div key={bar.label} style={barColStyle}>
                    <div style={barTrackStyle}>
                      <div
                        style={{
                          ...barFillStyle,
                          height: `${bar.value}%`,
                        }}
                      />
                    </div>
                    <div style={barLabelStyle}>{bar.label}</div>
                    <div style={barAmountStyle}>{bar.amount}</div>
                  </div>
                ))}
              </div>

              <div className="analytics-foot-row" style={analyticsFootRowStyle}>
                <div style={summaryMetricStyle}>
                  <div style={summaryMetricLabelStyle}>Active clients</div>
                  <div style={summaryMetricValueStyle}>7</div>
                </div>
                <div style={summaryMetricStyle}>
                  <div style={summaryMetricLabelStyle}>Average task value</div>
                  <div style={summaryMetricValueStyle}>$426</div>
                </div>
                <div style={summaryMetricStyle}>
                  <div style={summaryMetricLabelStyle}>Saved this month</div>
                  <div style={summaryMetricValueStyle}>43 tasks</div>
                </div>
              </div>
            </div>

            <div style={analyticsCardStyle}>
              <div style={analyticsHeaderStyle}>
                <div>
                  <div style={analyticsLabelStyle}>Workspace overview</div>
                  <div style={analyticsTitleStyle}>Task health</div>
                </div>
                <div style={analyticsChipStyle}>Live</div>
              </div>

              <div style={pipelineListStyle}>
                {pipelineRows.map((row) => (
                  <div key={row.label} style={pipelineRowStyle}>
                    <div style={pipelineLabelStyle}>{row.label}</div>
                    <div style={pipelineValueStyle(row.tone)}>{row.value}</div>
                  </div>
                ))}
              </div>

              <div style={healthTableWrapStyle}>
                <table style={miniTableStyle}>
                  <thead>
                    <tr>
                      <th style={miniHeadStyle}>Client</th>
                      <th style={miniHeadStyle}>Amount</th>
                      <th style={miniHeadStyle}>Due</th>
                      <th style={miniHeadStyle}>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {healthRows.map((row) => (
                      <tr key={`${row.name}-${row.amount}`} style={miniRowStyle}>
                        <td style={miniCellStrongStyle}>{row.name}</td>
                        <td style={miniCellStyle}>{row.amount}</td>
                        <td style={miniCellStyle}>{row.due}</td>
                        <td style={miniCellStyle}>
                          <span style={priorityBadgeStyle(row.status)}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" style={sectionStyle}>
          <SectionEyebrow>PRICING</SectionEyebrow>
          <h2 className="section-title" style={sectionTitleStyle}>
            Simple pricing for a simple workflow.
          </h2>
          <p style={sectionTextStyle}>
            Start free with 30 total extracts. Upgrade only when Text2Task
            becomes part of your daily client workflow.
          </p>

          <div className="pricing-grid" style={pricingGridStyle}>
            <div style={pricingCardStyle}>
              <div style={planNameStyle}>Free</div>
              <div style={priceRowStyle}>
                <span style={priceValueStyle}>$0</span>
              </div>

              <div style={planDescriptionStyle}>
                For testing Text2Task with real client messages.
              </div>

              <div style={planFeaturesListStyle}>
                <PlanItem text="30 total AI extracts" />
                <PlanItem text="Text and image extraction" />
                <PlanItem text="Save to tasks" />
                <PlanItem text="Dashboard and task workspace" />
                <PlanItem text="CSV export not included" />
              </div>

              <Link href="/signup" style={fullWidthPrimaryButtonStyle}>
                Try Text2Task
              </Link>
            </div>

            <div style={proCardStyle}>
              <div style={bestValueTagStyle}>Best value</div>
              <div style={planNameStyle}>Pro</div>
              <div style={priceRowStyle}>
                <span style={priceValueStyle}>$12.90</span>
                <span style={perMonthStyle}>/ month</span>
              </div>

              <div style={planDescriptionStyle}>
                For freelancers and small teams using Text2Task every day.
              </div>

              <div style={planFeaturesListStyle}>
                <PlanItem text="Unlimited AI extracts" />
                <PlanItem text="Unlimited saved tasks" />
                <PlanItem text="CSV export" />
                <PlanItem text="Dashboard analytics" />
                <PlanItem text="Future Pro features included" />
              </div>

              <Link href="/signup" style={fullWidthProButtonStyle}>
                Upgrade to Pro
              </Link>
            </div>
          </div>
        </section>

        <section style={finalCtaStyle}>
          <div>
            <div className="final-title" style={finalTitleStyle}>
              Ready to turn your next client message into tasks?
            </div>
            <div style={finalTextStyle}>
              Try Text2Task free and organize real client work in seconds.
            </div>
          </div>

          <Link href="/signup" style={finalButtonStyle}>
            Try Text2Task
          </Link>
        </section>

        <LandingFooter />
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoCardStyle}>
      <div style={infoLabelStyle}>{label}</div>
      <div style={infoValueStyle}>{value}</div>
    </div>
  );
}

function MiniStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={miniStatCardStyle}>
      <div style={miniStatLabelStyle}>{label}</div>
      <div style={miniStatValueStyle}>{value}</div>
    </div>
  );
}

function PlanItem({ text }: { text: string }) {
  return (
    <div style={planItemStyle}>
      <span style={planCheckStyle}>✓</span>
      <span>{text}</span>
    </div>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <div style={sectionEyebrowStyle}>{children}</div>;
}

const responsiveCss = `
  @media (max-width: 1080px) {
    .hero-section {
      gap: 34px !important;
    }

    .hero-left {
      max-width: 100% !important;
    }

    .hero-right {
      justify-content: flex-start !important;
    }

    .before-after-grid,
    .analytics-grid,
    .pricing-grid {
      grid-template-columns: 1fr !important;
    }

    .grid-three {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
  }

  @media (max-width: 720px) {
    .landing-container {
      padding: 22px 18px 54px !important;
    }

    .landing-nav-shell {
      align-items: flex-start !important;
    }

    .landing-nav-links {
      width: 100% !important;
      display: grid !important;
      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      gap: 8px !important;
    }

    .landing-nav-links a {
      text-align: center !important;
      font-size: 12px !important;
      padding: 9px 6px !important;
      border-radius: 12px !important;
    }

    .landing-nav-links a:last-child {
      grid-column: 1 / -1 !important;
      min-height: 44px !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
    }

    .hero-title {
      font-size: 46px !important;
      line-height: 0.98 !important;
      letter-spacing: -0.055em !important;
    }

    .hero-subtitle {
      font-size: 16px !important;
      line-height: 1.7 !important;
    }

    .hero-cta-row {
      display: grid !important;
      grid-template-columns: 1fr !important;
    }

    .hero-cta-row a {
      width: 100% !important;
      box-sizing: border-box !important;
    }

    .hero-trust-row {
      display: grid !important;
      gap: 8px !important;
    }

    .preview-card {
      max-width: 100% !important;
      padding: 16px !important;
      border-radius: 24px !important;
    }

    .grid-three,
    .grid-two,
    .before-after-grid,
    .analytics-grid,
    .pricing-grid,
    .analytics-foot-row,
    .kpi-row {
      grid-template-columns: 1fr !important;
    }

    .section-title {
      font-size: 34px !important;
      line-height: 1.1 !important;
    }

    .final-title {
      font-size: 30px !important;
    }
  }
`;

const shellStyle: CSSProperties = {
  width: "100%",
};

const containerStyle: CSSProperties = {
  width: "100%",
  maxWidth: 1280,
  margin: "0 auto",
  padding: "28px 28px 72px",
  color: "#0f172a",
};

const navStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 20,
  flexWrap: "wrap",
  marginBottom: 34,
};

const logoStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 12,
  textDecoration: "none",
  color: "#0f172a",
  fontWeight: 900,
  fontSize: 22,
};

const logoDotStyle: CSSProperties = {
  width: 16,
  height: 16,
  borderRadius: 999,
  background: "linear-gradient(135deg,#8b5cf6,#60a5fa)",
  boxShadow: "0 0 0 5px rgba(99,102,241,0.12)",
};

const navLinksStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
};

const navLinkStyle: CSSProperties = {
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 700,
  fontSize: 16,
  padding: "8px 10px",
};

const navButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 48,
  padding: "0 22px",
  borderRadius: 16,
  background: "linear-gradient(135deg,#0f172a,#111b48)",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 16,
  boxShadow: "0 12px 30px rgba(15,23,42,0.14)",
};

const heroSectionStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 54,
  flexWrap: "wrap",
  padding: "18px 0 10px",
};

const heroLeftStyle: CSSProperties = {
  flex: "1 1 560px",
  maxWidth: 640,
};

const heroRightStyle: CSSProperties = {
  flex: "0 1 470px",
  width: "100%",
  display: "flex",
  justifyContent: "flex-end",
};

const heroTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(50px, 6.4vw, 72px)",
  lineHeight: 0.98,
  fontWeight: 900,
  letterSpacing: "-0.058em",
  color: "#0f172a",
};

const heroTitleAccentStyle: CSSProperties = {
  color: "#4f46e5",
  display: "inline-block",
};

const heroSubtitleStyle: CSSProperties = {
  marginTop: 24,
  marginBottom: 0,
  fontSize: 19,
  lineHeight: 1.68,
  color: "#475569",
  maxWidth: 620,
};

const heroCtaRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  flexWrap: "wrap",
  marginTop: 26,
};

const primaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 54,
  padding: "0 24px",
  borderRadius: 16,
  background: "linear-gradient(135deg,#0f172a,#111b48)",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 18,
  boxShadow: "0 16px 34px rgba(15,23,42,0.16)",
};

const secondaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 54,
  padding: "0 24px",
  borderRadius: 16,
  background: "#ffffff",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 18,
  border: "1px solid #dbe4f1",
};

const heroTrustRowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 18,
};

const trustItemStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 34,
  padding: "0 12px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.78)",
  border: "1px solid #dbe4f1",
  fontSize: 14,
  color: "#475569",
  fontWeight: 800,
};

const previewCardStyle: CSSProperties = {
  width: "100%",
  maxWidth: 470,
  background: "rgba(255,255,255,0.84)",
  border: "1px solid #c9d8ff",
  borderRadius: 28,
  padding: 18,
  boxShadow: "0 26px 58px rgba(99,102,241,0.12)",
  backdropFilter: "blur(8px)",
};

const previewHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 14,
};

const previewBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  fontSize: 14,
  fontWeight: 900,
  color: "#0f172a",
};

const previewBadgeDotStyle: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: 999,
  background: "#22c55e",
  boxShadow: "0 0 0 4px rgba(34,197,94,0.12)",
};

const messageBoxStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe4f1",
  borderRadius: 20,
  padding: 16,
};

const messageLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
  letterSpacing: "0.08em",
  marginBottom: 10,
};

const messageTextStyle: CSSProperties = {
  fontSize: 16,
  lineHeight: 1.62,
  color: "#1e293b",
};

const extractingBarStyle: CSSProperties = {
  marginTop: 12,
  borderRadius: 17,
  padding: "13px 13px",
  background:
    "linear-gradient(135deg,rgba(99,102,241,0.14),rgba(96,165,250,0.12))",
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const extractingIconStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 10,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#6366f1",
  color: "#ffffff",
  fontWeight: 900,
  fontSize: 12,
  flexShrink: 0,
};

const extractingTextStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  lineHeight: 1.42,
  color: "#4f46e5",
};

const infoGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
  marginTop: 12,
};

const infoCardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe4f1",
  borderRadius: 17,
  padding: 13,
};

const infoLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
  marginBottom: 7,
};

const infoValueStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: "#0f172a",
  lineHeight: 1.35,
};

const emailWideCardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dbe4f1",
  borderRadius: 17,
  padding: 13,
  marginTop: 10,
};

const wideLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
  marginBottom: 7,
};

const wideValueStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: "#0f172a",
};

const previewFooterStyle: CSSProperties = {
  marginTop: 12,
  borderRadius: 17,
  padding: "13px 13px",
  background: "linear-gradient(135deg,#0f172a,#1e1b66)",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
};

const previewFooterTextStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  lineHeight: 1.35,
};

const saveButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 40,
  padding: "0 16px",
  borderRadius: 13,
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 900,
  fontSize: 15,
  whiteSpace: "nowrap",
};

const sectionStyle: CSSProperties = {
  paddingTop: 86,
};

const sectionEyebrowStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  letterSpacing: "0.09em",
  color: "#4f46e5",
  marginBottom: 16,
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "clamp(36px, 5vw, 56px)",
  lineHeight: 1.05,
  letterSpacing: "-0.045em",
  fontWeight: 900,
  maxWidth: 920,
  color: "#0f172a",
};

const sectionTextStyle: CSSProperties = {
  marginTop: 18,
  marginBottom: 0,
  maxWidth: 860,
  fontSize: 20,
  lineHeight: 1.65,
  color: "#475569",
};

const cardGridThreeStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 18,
  marginTop: 34,
};

const cardGridTwoStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 18,
  marginTop: 34,
};

const audienceCardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.84)",
  border: "1px solid #dbe4f1",
  borderRadius: 22,
  padding: 22,
  display: "flex",
  alignItems: "flex-start",
  gap: 14,
};

const featureCardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.84)",
  border: "1px solid #dbe4f1",
  borderRadius: 22,
  padding: 22,
  display: "flex",
  alignItems: "flex-start",
  gap: 14,
};

const checkBubbleStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 999,
  background: "rgba(34,197,94,0.12)",
  color: "#16a34a",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  flexShrink: 0,
};

const smallCardTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#0f172a",
  marginBottom: 8,
};

const smallCardTextStyle: CSSProperties = {
  fontSize: 17,
  lineHeight: 1.6,
  color: "#64748b",
};

const beforeAfterGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 22,
  marginTop: 34,
};

const largePanelStyle: CSSProperties = {
  background: "rgba(255,255,255,0.84)",
  border: "1px solid #dbe4f1",
  borderRadius: 28,
  padding: 24,
  boxShadow: "0 12px 30px rgba(15,23,42,0.04)",
};

const panelTopRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 18,
};

const panelTagStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(99,102,241,0.10)",
  color: "#4f46e5",
  fontWeight: 900,
  fontSize: 13,
  letterSpacing: "0.04em",
  marginBottom: 12,
};

const panelTitleStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  letterSpacing: "-0.03em",
  color: "#0f172a",
};

const inboxCountStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 38,
  padding: "0 14px",
  borderRadius: 999,
  background: "#fee2e2",
  color: "#b91c1c",
  fontWeight: 900,
  fontSize: 14,
  whiteSpace: "nowrap",
};

const inboxShellStyle: CSSProperties = {
  display: "grid",
  gap: 12,
};

const emailRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "44px 1fr auto",
  gap: 14,
  alignItems: "flex-start",
  padding: 16,
  borderRadius: 18,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
};

const emailAvatarStyle: CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: 999,
  background: "linear-gradient(135deg,#c7d2fe,#bfdbfe)",
  color: "#3730a3",
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 16,
};

const emailContentStyle: CSSProperties = {
  minWidth: 0,
};

const emailTopLineStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const emailSenderStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "#0f172a",
};

const emailTimeStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#94a3b8",
};

const emailSubjectStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: "#1e293b",
  marginTop: 2,
};

const emailPreviewStyle: CSSProperties = {
  fontSize: 14,
  color: "#64748b",
  lineHeight: 1.55,
  marginTop: 6,
};

const emailBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 30,
  padding: "0 10px",
  borderRadius: 999,
  background: "#eef2ff",
  color: "#4f46e5",
  fontWeight: 900,
  fontSize: 12,
  whiteSpace: "nowrap",
};

const workspaceBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 38,
  padding: "0 14px",
  borderRadius: 999,
  background: "rgba(34,197,94,0.12)",
  color: "#15803d",
  fontWeight: 900,
  fontSize: 14,
  whiteSpace: "nowrap",
};

const workspaceKpiRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const miniStatCardStyle: CSSProperties = {
  background: "#f8fbff",
  border: "1px solid #dbe4f1",
  borderRadius: 18,
  padding: 14,
};

const miniStatLabelStyle: CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  fontWeight: 800,
  marginBottom: 8,
};

const miniStatValueStyle: CSSProperties = {
  fontSize: 24,
  color: "#0f172a",
  fontWeight: 900,
};

const tableWrapStyle: CSSProperties = {
  overflowX: "auto",
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  background: "#ffffff",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const tableHeadStyle: CSSProperties = {
  textAlign: "left",
  padding: "14px 16px",
  fontSize: 13,
  fontWeight: 900,
  color: "#64748b",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
};

const tableRowStyle: CSSProperties = {
  borderBottom: "1px solid #eef2f7",
};

const tableCellStyle: CSSProperties = {
  padding: "14px 16px",
  fontSize: 15,
  color: "#475569",
  fontWeight: 700,
};

const tableCellStrongStyle: CSSProperties = {
  padding: "14px 16px",
  fontSize: 15,
  color: "#0f172a",
  fontWeight: 900,
};

const analyticsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.1fr 0.9fr",
  gap: 22,
  marginTop: 34,
};

const analyticsCardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.84)",
  border: "1px solid #dbe4f1",
  borderRadius: 28,
  padding: 24,
};

const analyticsHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 22,
};

const analyticsLabelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#4f46e5",
  marginBottom: 8,
};

const analyticsTitleStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: "#0f172a",
  letterSpacing: "-0.03em",
};

const analyticsChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 34,
  padding: "0 12px",
  borderRadius: 999,
  background: "rgba(99,102,241,0.10)",
  color: "#4f46e5",
  fontWeight: 900,
  fontSize: 13,
};

const chartAreaStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 18,
  alignItems: "end",
  minHeight: 240,
};

const barColStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
};

const barTrackStyle: CSSProperties = {
  width: "100%",
  maxWidth: 58,
  height: 170,
  borderRadius: 999,
  background: "linear-gradient(180deg,#eef4ff,#f8fafc)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  padding: 6,
};

const barFillStyle: CSSProperties = {
  width: "100%",
  borderRadius: 999,
  background: "linear-gradient(180deg,#818cf8,#4f46e5)",
  boxShadow: "0 8px 20px rgba(79,70,229,0.20)",
};

const barLabelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#64748b",
};

const barAmountStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#0f172a",
};

const analyticsFootRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
  marginTop: 22,
};

const summaryMetricStyle: CSSProperties = {
  background: "#f8fbff",
  border: "1px solid #dbe4f1",
  borderRadius: 18,
  padding: 14,
};

const summaryMetricLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#64748b",
  marginBottom: 8,
};

const summaryMetricValueStyle: CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#0f172a",
};

const pipelineListStyle: CSSProperties = {
  display: "grid",
  gap: 10,
};

const pipelineRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  padding: "14px 16px",
  borderRadius: 16,
  background: "#f8fbff",
  border: "1px solid #dbe4f1",
};

const pipelineLabelStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: "#0f172a",
};

const pipelineValueStyle = (tone: string): CSSProperties => {
  const colorMap: Record<string, string> = {
    dark: "#0f172a",
    purple: "#4f46e5",
    blue: "#2563eb",
    green: "#16a34a",
  };

  return {
    fontSize: 18,
    fontWeight: 900,
    color: colorMap[tone] || "#0f172a",
  };
};

const healthTableWrapStyle: CSSProperties = {
  marginTop: 18,
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  overflowX: "auto",
  background: "#ffffff",
};

const miniTableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const miniHeadStyle: CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
};

const miniRowStyle: CSSProperties = {
  borderBottom: "1px solid #eef2f7",
};

const miniCellStyle: CSSProperties = {
  padding: "12px 14px",
  fontSize: 14,
  color: "#475569",
  fontWeight: 700,
};

const miniCellStrongStyle: CSSProperties = {
  padding: "12px 14px",
  fontSize: 14,
  color: "#0f172a",
  fontWeight: 900,
};

const pricingGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 18,
  marginTop: 32,
};

const pricingCardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.84)",
  border: "1px solid #dbe4f1",
  borderRadius: 28,
  padding: 24,
  position: "relative",
};

const proCardStyle: CSSProperties = {
  background: "rgba(255,255,255,0.84)",
  border: "1px solid #c7d2fe",
  borderRadius: 28,
  padding: 24,
  position: "relative",
  boxShadow: "0 18px 40px rgba(79,70,229,0.08)",
};

const bestValueTagStyle: CSSProperties = {
  position: "absolute",
  top: 18,
  right: 18,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 32,
  padding: "0 12px",
  borderRadius: 999,
  background: "rgba(99,102,241,0.10)",
  color: "#4f46e5",
  fontSize: 12,
  fontWeight: 900,
};

const planNameStyle: CSSProperties = {
  fontSize: 34,
  fontWeight: 900,
  color: "#0f172a",
  letterSpacing: "-0.03em",
};

const priceRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  gap: 8,
  marginTop: 12,
};

const priceValueStyle: CSSProperties = {
  fontSize: 56,
  fontWeight: 900,
  letterSpacing: "-0.05em",
  color: "#0f172a",
  lineHeight: 1,
};

const perMonthStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: "#64748b",
  marginBottom: 8,
};

const planDescriptionStyle: CSSProperties = {
  marginTop: 18,
  fontSize: 18,
  lineHeight: 1.6,
  color: "#475569",
};

const planFeaturesListStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  marginTop: 22,
  marginBottom: 26,
};

const planItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  fontSize: 17,
  fontWeight: 700,
  color: "#0f172a",
};

const planCheckStyle: CSSProperties = {
  color: "#16a34a",
  fontWeight: 900,
  fontSize: 18,
};

const fullWidthPrimaryButtonStyle: CSSProperties = {
  width: "100%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 54,
  borderRadius: 16,
  background: "linear-gradient(135deg,#0f172a,#111b48)",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 18,
};

const fullWidthProButtonStyle: CSSProperties = {
  width: "100%",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 54,
  borderRadius: 16,
  background: "linear-gradient(135deg,#4f46e5,#6366f1)",
  color: "#ffffff",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 18,
};

const finalCtaStyle: CSSProperties = {
  marginTop: 74,
  borderRadius: 30,
  padding: "32px 32px",
  background: "linear-gradient(135deg,#0f172a,#1d1b61)",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 22,
  flexWrap: "wrap",
};

const finalTitleStyle: CSSProperties = {
  fontSize: 42,
  fontWeight: 900,
  letterSpacing: "-0.04em",
  marginBottom: 10,
  lineHeight: 1.05,
};

const finalTextStyle: CSSProperties = {
  fontSize: 20,
  lineHeight: 1.6,
  color: "rgba(226,232,240,0.86)",
  maxWidth: 700,
};

const finalButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 54,
  padding: "0 24px",
  borderRadius: 16,
  background: "#ffffff",
  color: "#0f172a",
  textDecoration: "none",
  fontWeight: 900,
  fontSize: 18,
};

const priorityBadgeStyle = (priority: string): CSSProperties => {
  const map: Record<string, { background: string; color: string }> = {
    High: {
      background: "rgba(254,226,226,1)",
      color: "#b91c1c",
    },
    Medium: {
      background: "rgba(254,249,195,1)",
      color: "#a16207",
    },
    Low: {
      background: "rgba(220,252,231,1)",
      color: "#15803d",
    },
  };

  const tone = map[priority] || map.Medium;

  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
    padding: "0 10px",
    borderRadius: 999,
    background: tone.background,
    color: tone.color,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  };
};