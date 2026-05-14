"use client";

import type { CSSProperties } from "react";

type PreviewGridSectionProps = {
  jakartaClassName: string;
};

const extractedFields = [
  { label: "Client", value: "Sarah Mitchell" },
  { label: "Company", value: "Brightside Dental" },
  { label: "Budget", value: "$1,200" },
  { label: "Deadline", value: "Next Friday" },
  { label: "Email", value: "sarah@brightside.com" },
  { label: "Phone", value: "212-555-8912" },
];

const extractedTasks = [
  "Landing page update",
  "3 banner variations",
  "Logo cleanup",
];

export default function PreviewGridSection({
  jakartaClassName,
}: PreviewGridSectionProps) {
  return (
    <section
      style={{
        marginTop: "46px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          alignItems: "stretch",
        }}
      >
        <div style={cardStyle}>
          <div className={jakartaClassName} style={eyebrowStyle}>
            Before
          </div>

          <div className={jakartaClassName} style={titleStyle}>
            Messy client message
          </div>

          <div style={messageCardStyle}>
            <div style={messageBadgeStyle}>WhatsApp / Email / DM</div>

            <p style={messageTextStyle}>
              “Hey, I need a landing page refresh, 3 banner variations, and a
              quick logo cleanup. Budget is around $1,200. Can you send the
              first draft by next Friday? You can reach me at
              sarah@brightside.com or 212-555-8912.”
            </p>
          </div>

          <div style={chipsWrapStyle}>
            <span style={warningChipStyle}>Task hidden in text</span>
            <span style={warningChipStyle}>Deadline buried in message</span>
            <span style={warningChipStyle}>Budget mixed with notes</span>
          </div>
        </div>

        <div style={cardStyle}>
          <div className={jakartaClassName} style={eyebrowStyle}>
            After
          </div>

          <div className={jakartaClassName} style={titleStyle}>
            Structured extraction preview
          </div>

          <div style={aiBarStyle}>
            <span style={aiDotStyle}>AI</span>
            <span style={aiBarTextStyle}>
              Extracting task, deadline, budget, client details, email, and
              phone...
            </span>
          </div>

          <div style={fieldsGridStyle}>
            {extractedFields.map((field) => (
              <div key={field.label} style={fieldCardStyle}>
                <div style={fieldLabelStyle}>{field.label}</div>
                <div style={fieldValueStyle}>{field.value}</div>
              </div>
            ))}
          </div>

          <div style={taskListCardStyle}>
            <div style={taskListTitleStyle}>Detected tasks</div>

            <div style={taskListWrapStyle}>
              {extractedTasks.map((task) => (
                <div key={task} style={taskItemStyle}>
                  <span style={taskBulletStyle} />
                  <span>{task}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const cardStyle: CSSProperties = {
  background: "#ffffff",
  borderRadius: "24px",
  border: "1px solid #e2e8f0",
  padding: "22px",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
};

const eyebrowStyle: CSSProperties = {
  fontSize: "13px",
  fontWeight: 800,
  color: "#4f46e5",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: "10px",
};

const titleStyle: CSSProperties = {
  fontSize: "28px",
  fontWeight: 800,
  letterSpacing: "-0.04em",
  color: "#0f172a",
  marginBottom: "18px",
};

const messageCardStyle: CSSProperties = {
  background: "#f8fafc",
  borderRadius: "20px",
  border: "1px solid #e2e8f0",
  padding: "18px",
};

const messageBadgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: "999px",
  background: "rgba(99,102,241,0.10)",
  color: "#4f46e5",
  fontSize: "12px",
  fontWeight: 800,
  padding: "8px 12px",
  marginBottom: "14px",
};

const messageTextStyle: CSSProperties = {
  margin: 0,
  fontSize: "18px",
  lineHeight: 1.8,
  color: "#334155",
  fontWeight: 500,
};

const chipsWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "10px",
  marginTop: "16px",
};

const warningChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "9px 12px",
  borderRadius: "999px",
  background: "#fff7ed",
  border: "1px solid #fdba74",
  color: "#c2410c",
  fontSize: "13px",
  fontWeight: 700,
};

const aiBarStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  background: "linear-gradient(135deg, rgba(99,102,241,0.12), rgba(96,165,250,0.10))",
  border: "1px solid rgba(99,102,241,0.12)",
  borderRadius: "18px",
  padding: "14px 16px",
  marginBottom: "18px",
};

const aiDotStyle: CSSProperties = {
  width: "34px",
  height: "34px",
  borderRadius: "999px",
  background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
  color: "#ffffff",
  fontSize: "12px",
  fontWeight: 900,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const aiBarTextStyle: CSSProperties = {
  fontSize: "15px",
  color: "#4338ca",
  fontWeight: 700,
  lineHeight: 1.5,
};

const fieldsGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "12px",
};

const fieldCardStyle: CSSProperties = {
  background: "#ffffff",
  borderRadius: "18px",
  border: "1px solid #e2e8f0",
  padding: "14px 14px 16px",
};

const fieldLabelStyle: CSSProperties = {
  fontSize: "12px",
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: "8px",
};

const fieldValueStyle: CSSProperties = {
  fontSize: "18px",
  fontWeight: 800,
  color: "#0f172a",
  lineHeight: 1.4,
};

const taskListCardStyle: CSSProperties = {
  marginTop: "14px",
  background: "#f8fafc",
  borderRadius: "20px",
  border: "1px solid #e2e8f0",
  padding: "16px",
};

const taskListTitleStyle: CSSProperties = {
  fontSize: "14px",
  fontWeight: 800,
  color: "#0f172a",
  marginBottom: "12px",
};

const taskListWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const taskItemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  fontSize: "15px",
  color: "#334155",
  fontWeight: 700,
};

const taskBulletStyle: CSSProperties = {
  width: "10px",
  height: "10px",
  borderRadius: "999px",
  background: "#6366f1",
  flexShrink: 0,
};