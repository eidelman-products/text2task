import type { CSSProperties } from "react";

type ExtractWorkspaceHeroProps = {
  plan: "free" | "pro";
};

export default function ExtractWorkspaceHero({
  plan,
}: ExtractWorkspaceHeroProps) {
  const isPro = plan === "pro";

  return (
    <section className="extract-premium-hero" style={heroShellStyle}>
      <div style={heroGlowOneStyle} />
      <div style={heroGlowTwoStyle} />

      <div style={heroContentStyle}>
        <div style={heroCopyStyle}>
          <div style={eyebrowStyle}>Extract workspace</div>

          <h1 style={heroTitleStyle}>
            Turn client work requests into structured tasks
          </h1>

          <p style={heroDescriptionStyle}>
            Convert client messages, screenshots, and briefs into organized
            project tasks, deadlines, and details — so you can work faster and
            stay on top of every job.
          </p>

          <div style={heroBadgesStyle}>
            <HeroBadge icon="✦" label="Text requests" />
            <HeroBadge icon="▣" label="Screenshots" />
            <HeroBadge icon="✓" label="Project preview" />
          </div>
        </div>

        <div style={heroVisualStyle} aria-hidden="true">
          <div style={requestStackStyle}>
            <RequestBubble
              icon="💬"
              text="Need homepage edits"
              rotate="-2deg"
            />
            <RequestBubble
              icon="📩"
              text="First draft by Friday"
              rotate="2deg"
            />
            <RequestBubble
              icon="🎨"
              text="Add 3 social post designs"
              rotate="-1deg"
            />
            <RequestBubble
              icon="💵"
              text="Update invoice details"
              rotate="1deg"
            />
          </div>

          <div style={flowArrowStyle}>→</div>

          <div style={taskCardStyle}>
            <div style={taskCardHeaderStyle}>
              <div style={taskCardIconStyle}>T2</div>

              <div>
                <div style={taskCardTitleStyle}>Client project</div>
                <div style={taskCardSubStyle}>4 tasks extracted</div>
              </div>
            </div>

            <div style={taskListStyle}>
              <TaskLine label="Update homepage hero" date="May 16" />
              <TaskLine label="Create 3 social designs" date="May 18" />
              <TaskLine label="Send first draft" date="May 16" />
              <TaskLine label="Update invoice details" date="May 17" />
            </div>
          </div>
        </div>
      </div>

      <div style={heroTopRightStyle}>
        <div
          style={{
            ...planPillStyle,
            background: isPro
              ? "rgba(236,253,245,0.96)"
              : "rgba(238,242,255,0.96)",
            borderColor: isPro
              ? "rgba(167,243,208,0.92)"
              : "rgba(199,210,254,0.92)",
            color: isPro ? "#065f46" : "#4338ca",
          }}
        >
          <span
            style={{
              ...planDotStyle,
              background: isPro ? "#22c55e" : "#6366f1",
            }}
          />
          Current plan: {plan.toUpperCase()}
        </div>
      </div>
    </section>
  );
}

function HeroBadge({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={heroBadgeStyle}>
      <span style={heroBadgeIconStyle}>{icon}</span>
      {label}
    </div>
  );
}

function RequestBubble({
  icon,
  text,
  rotate,
}: {
  icon: string;
  text: string;
  rotate: string;
}) {
  return (
    <div
      style={{
        ...requestBubbleStyle,
        transform: `rotate(${rotate})`,
      }}
    >
      <span style={requestBubbleIconStyle}>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function TaskLine({ label, date }: { label: string; date: string }) {
  return (
    <div style={taskLineStyle}>
      <div style={taskLineLeftStyle}>
        <span style={taskCheckStyle}>✓</span>
        <span>{label}</span>
      </div>

      <span style={taskDateStyle}>{date}</span>
    </div>
  );
}

const heroShellStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  borderRadius: 30,
  padding: 30,
  minHeight: 300,
  background:
    "radial-gradient(circle at 18% 10%, rgba(129,140,248,0.50) 0%, transparent 28%), radial-gradient(circle at 85% 20%, rgba(14,165,233,0.32) 0%, transparent 30%), linear-gradient(135deg, #111827 0%, #312e81 48%, #4f46e5 100%)",
  border: "1px solid rgba(199,210,254,0.22)",
  boxShadow:
    "0 30px 80px rgba(30,41,59,0.20), inset 0 1px 0 rgba(255,255,255,0.18)",
};

const heroGlowOneStyle: CSSProperties = {
  position: "absolute",
  width: 260,
  height: 260,
  borderRadius: 999,
  background: "rgba(255,255,255,0.12)",
  filter: "blur(34px)",
  top: -110,
  right: 220,
  pointerEvents: "none",
};

const heroGlowTwoStyle: CSSProperties = {
  position: "absolute",
  width: 300,
  height: 300,
  borderRadius: 999,
  background: "rgba(59,130,246,0.20)",
  filter: "blur(38px)",
  bottom: -160,
  left: 220,
  pointerEvents: "none",
};

const heroContentStyle: CSSProperties = {
  position: "relative",
  zIndex: 2,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.05fr) minmax(360px, 0.95fr)",
  gap: 30,
  alignItems: "center",
};

const heroCopyStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  maxWidth: 720,
};

const eyebrowStyle: CSSProperties = {
  width: "fit-content",
  borderRadius: 999,
  padding: "8px 11px",
  color: "#dbeafe",
  background: "rgba(255,255,255,0.10)",
  border: "1px solid rgba(255,255,255,0.16)",
  fontSize: 11,
  fontWeight: 850,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
};

const heroTitleStyle: CSSProperties = {
  margin: 0,
  color: "#ffffff",
  fontSize: 40,
  lineHeight: 1.12,
  fontWeight: 850,
  letterSpacing: "-0.035em",
  maxWidth: 720,
  textShadow: "0 2px 18px rgba(15,23,42,0.22)",
};

const heroDescriptionStyle: CSSProperties = {
  margin: 0,
  color: "rgba(239,246,255,0.90)",
  fontSize: 15,
  lineHeight: 1.75,
  fontWeight: 560,
  maxWidth: 680,
};

const heroBadgesStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: 9,
  paddingTop: 5,
};

const heroBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 999,
  padding: "9px 12px",
  background: "rgba(255,255,255,0.12)",
  border: "1px solid rgba(255,255,255,0.17)",
  color: "#ffffff",
  fontSize: 12,
  fontWeight: 760,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
};

const heroBadgeIconStyle: CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  width: 19,
  height: 19,
  borderRadius: 999,
  background: "rgba(255,255,255,0.14)",
  fontSize: 10,
};

const heroVisualStyle: CSSProperties = {
  position: "relative",
  minHeight: 238,
  display: "grid",
  gridTemplateColumns: "1fr 42px 1.15fr",
  alignItems: "center",
  gap: 10,
};

const requestStackStyle: CSSProperties = {
  display: "grid",
  gap: 9,
};

const requestBubbleStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  width: "100%",
  maxWidth: 245,
  borderRadius: 17,
  padding: "11px 12px",
  background: "rgba(255,255,255,0.93)",
  color: "#1e293b",
  border: "1px solid rgba(255,255,255,0.55)",
  boxShadow: "0 16px 36px rgba(15,23,42,0.18)",
  fontSize: 12,
  fontWeight: 760,
};

const requestBubbleIconStyle: CSSProperties = {
  width: 25,
  height: 25,
  borderRadius: 10,
  display: "grid",
  placeItems: "center",
  background: "#eef2ff",
  fontSize: 12,
  flexShrink: 0,
};

const flowArrowStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 38,
  height: 38,
  borderRadius: 999,
  background: "rgba(255,255,255,0.14)",
  border: "1px solid rgba(255,255,255,0.20)",
  color: "#ffffff",
  fontSize: 23,
  fontWeight: 850,
  boxShadow: "0 14px 34px rgba(15,23,42,0.12)",
};

const taskCardStyle: CSSProperties = {
  borderRadius: 24,
  padding: 15,
  background: "rgba(255,255,255,0.94)",
  border: "1px solid rgba(255,255,255,0.62)",
  boxShadow: "0 24px 55px rgba(15,23,42,0.23)",
  minWidth: 0,
};

const taskCardHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  paddingBottom: 11,
  borderBottom: "1px solid rgba(226,232,240,0.9)",
};

const taskCardIconStyle: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 15,
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, #4f46e5 0%, #0ea5e9 100%)",
  color: "#ffffff",
  fontSize: 11,
  fontWeight: 850,
  boxShadow: "0 12px 24px rgba(79,70,229,0.24)",
};

const taskCardTitleStyle: CSSProperties = {
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 850,
  letterSpacing: "-0.018em",
};

const taskCardSubStyle: CSSProperties = {
  marginTop: 2,
  color: "#64748b",
  fontSize: 11,
  fontWeight: 700,
};

const taskListStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  paddingTop: 12,
};

const taskLineStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  borderRadius: 13,
  padding: "8px 9px",
  background: "#f8fafc",
  color: "#334155",
  fontSize: 11,
  fontWeight: 760,
};

const taskLineLeftStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
};

const taskCheckStyle: CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 999,
  display: "grid",
  placeItems: "center",
  background: "#dcfce7",
  color: "#15803d",
  fontSize: 10,
  fontWeight: 850,
  flexShrink: 0,
};

const taskDateStyle: CSSProperties = {
  color: "#4f46e5",
  fontSize: 10,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const heroTopRightStyle: CSSProperties = {
  position: "absolute",
  top: 18,
  right: 18,
  zIndex: 3,
};

const planPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  borderRadius: 999,
  padding: "9px 12px",
  border: "1px solid",
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
  boxShadow:
    "0 10px 26px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,0.7)",
};

const planDotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  flexShrink: 0,
};