import type { CSSProperties } from "react";

type ExtractWorkspaceHeroProps = {
  plan: "free" | "pro";
};

export default function ExtractWorkspaceHero({
  plan: _plan,
}: ExtractWorkspaceHeroProps) {
  return (
    <section className="extract-premium-hero" style={heroShellStyle}>
      <div style={blueWashStyle} />

      <div className="extract-premium-hero-content" style={heroContentStyle}>
        <div className="extract-premium-hero-copy" style={heroCopyStyle}>
          <h1 style={heroTitleStyle}>
            Turn client work requests into structured tasks
          </h1>

          <p style={heroDescriptionStyle}>
            Paste a client message, brief, email, or screenshot. Text2Task
            prepares a clean project preview with tasks, deadlines, budget,
            priority, contact details, and next steps before anything is saved.
          </p>
        </div>

        <div
          className="extract-premium-workflow"
          style={workflowStyle}
          aria-label="Extract workflow"
        >
          <WorkflowStep
            number="1"
            title="Paste or upload"
            description="Add a client message, email, brief, or screenshot."
          />

          <WorkflowArrow />

          <WorkflowStep
            number="2"
            title="AI structures the work"
            description="Text2Task detects tasks, deadlines, budget, priority, and client details."
          />

          <WorkflowArrow />

          <WorkflowStep
            number="3"
            title="Review and save"
            description="Approve the project preview before it is added to your CRM."
          />
        </div>
      </div>
    </section>
  );
}

function WorkflowStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="extract-premium-workflow-step" style={workflowStepStyle}>
      <div style={stepNumberStyle}>{number}</div>

      <div>
        <div style={stepTitleStyle}>{title}</div>
        <div style={stepDescriptionStyle}>{description}</div>
      </div>
    </div>
  );
}

function WorkflowArrow() {
  return (
    <div className="extract-premium-workflow-arrow" style={workflowArrowStyle}>
      →
    </div>
  );
}

const heroShellStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  padding: "26px 28px 18px",
  background: "transparent",
};

const blueWashStyle: CSSProperties = {
  position: "absolute",
  inset: "0 auto auto 0",
  width: "56%",
  height: 170,
  borderRadius: 999,
  background:
    "radial-gradient(circle at left center, rgba(37,99,235,0.12) 0%, rgba(219,234,254,0.45) 36%, transparent 72%)",
  filter: "blur(6px)",
  pointerEvents: "none",
};

const heroContentStyle: CSSProperties = {
  position: "relative",
  zIndex: 2,
  display: "grid",
  gridTemplateColumns: "minmax(0, 0.95fr) minmax(440px, 1.05fr)",
  gap: 42,
  alignItems: "center",
};

const heroCopyStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  maxWidth: 760,
};

const heroTitleStyle: CSSProperties = {
  margin: 0,
  color: "#0f172a",
  fontSize: 40,
  lineHeight: 1.08,
  fontWeight: 850,
  letterSpacing: "-0.05em",
  maxWidth: 760,
};

const heroDescriptionStyle: CSSProperties = {
  margin: 0,
  color: "#475569",
  fontSize: 15,
  lineHeight: 1.75,
  fontWeight: 560,
  maxWidth: 720,
};

const workflowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0, 1fr) 26px minmax(0, 1fr) 26px minmax(0, 1fr)",
  alignItems: "start",
  gap: 10,
};

const workflowStepStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr)",
  gap: 11,
  alignItems: "start",
  minWidth: 0,
};

const stepNumberStyle: CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  fontSize: 13,
  fontWeight: 900,
  boxShadow: "0 8px 18px rgba(37,99,235,0.08)",
};

const stepTitleStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
  lineHeight: 1.25,
  fontWeight: 900,
  letterSpacing: "-0.025em",
};

const stepDescriptionStyle: CSSProperties = {
  marginTop: 6,
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.55,
  fontWeight: 620,
};

const workflowArrowStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  color: "#2563eb",
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1,
  paddingTop: 4,
};
