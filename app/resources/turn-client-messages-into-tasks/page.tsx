import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/app/lib/site-config";

export const metadata: Metadata = {
  title: "Turn Client Messages Into Tasks: A Simple Workflow for Freelancers",
  description:
    "Learn a simple workflow for turning messy client messages, screenshots, budgets, deadlines, and notes into organized tasks.",
  alternates: {
    canonical: "/resources/turn-client-messages-into-tasks",
  },
  openGraph: {
    title: "Turn Client Messages Into Tasks: A Simple Workflow for Freelancers",
    description:
      "Learn a simple workflow for turning messy client messages, screenshots, budgets, deadlines, and notes into organized tasks.",
    url: absoluteUrl("/resources/turn-client-messages-into-tasks"),
    siteName: "Text2Task",
    type: "article",
  },
};

export default function ArticlePage() {
  return (
    <main style={pageStyle}>
      <article style={articleStyle}>
        <Link href="/resources" style={backLinkStyle}>
          ← Resources
        </Link>

        <p style={eyebrowStyle}>Client messages</p>

        <h1 style={h1Style}>
          Turn Client Messages Into Tasks: A Simple Workflow for Freelancers
        </h1>

        <p style={leadStyle}>
          Client messages are not always organized. They often include tasks,
          questions, screenshots, deadlines, budgets, and notes in one long
          conversation. A reliable workflow helps you turn that message into
          action.
        </p>

        <section style={sectionStyle}>
          <h2 style={h2Style}>Start with the raw message</h2>
          <p style={pStyle}>
            Do not try to rewrite the request immediately. First, collect the
            original message, email, screenshot, or note. Keeping the raw context
            helps prevent misunderstandings later.
          </p>

          <div style={exampleBoxStyle}>
            “Can you create three homepage options, update the pricing section,
            fix the contact form, and send the first version by next Friday?
            Budget is $600.”
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>Extract the useful fields</h2>
          <p style={pStyle}>
            A messy message becomes manageable when you extract the right
            fields:
          </p>

          <ul style={listStyle}>
            <li>Client name</li>
            <li>Task details</li>
            <li>Deadline</li>
            <li>Budget or amount</li>
            <li>Priority</li>
            <li>Notes and context</li>
          </ul>

          <p style={pStyle}>
            Once these fields are clear, the work becomes easier to track,
            estimate, delegate, and complete.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>Save the work somewhere structured</h2>
          <p style={pStyle}>
            The final step is saving the extracted work in a place you can
            return to. For some freelancers this is a spreadsheet. For others it
            is a task manager or CRM. The important part is that client work does
            not remain buried inside chat.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>How Text2Task speeds this up</h2>
          <p style={pStyle}>
            Text2Task helps turn messy client messages and screenshots into
            organized tasks. The AI creates a structured preview, and you stay
            in control by reviewing and editing before saving anything.
          </p>
        </section>

        <section style={ctaStyle}>
          <h2 style={ctaTitleStyle}>Try the workflow with your next message</h2>
          <p style={ctaTextStyle}>
            Paste a messy client message or upload a screenshot and turn it into
            organized tasks in seconds.
          </p>
          <Link href="/signup" style={ctaButtonStyle}>
            Try Text2Task free
          </Link>
        </section>
      </article>
    </main>
  );
}

const pageStyle = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "56px 18px 80px",
  color: "#0f172a",
} as const;

const articleStyle = {
  maxWidth: "820px",
  margin: "0 auto",
  background: "white",
  border: "1px solid #e2e8f0",
  borderRadius: "30px",
  padding: "clamp(26px, 5vw, 56px)",
  boxShadow: "0 22px 70px rgba(15,23,42,0.08)",
} as const;

const backLinkStyle = {
  color: "#2563eb",
  textDecoration: "none",
  fontWeight: 900,
} as const;

const eyebrowStyle = {
  marginTop: "32px",
  color: "#4f46e5",
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontSize: "13px",
} as const;

const h1Style = {
  fontSize: "clamp(36px, 6vw, 58px)",
  lineHeight: 1.05,
  letterSpacing: "-0.055em",
  margin: "10px 0 18px",
  fontWeight: 950,
} as const;

const leadStyle = {
  fontSize: "20px",
  lineHeight: 1.75,
  color: "#475569",
  fontWeight: 500,
} as const;

const sectionStyle = {
  marginTop: "38px",
} as const;

const h2Style = {
  fontSize: "28px",
  letterSpacing: "-0.035em",
  margin: "0 0 14px",
  fontWeight: 950,
} as const;

const pStyle = {
  fontSize: "17px",
  lineHeight: 1.85,
  color: "#334155",
  fontWeight: 500,
} as const;

const exampleBoxStyle = {
  margin: "22px 0",
  padding: "22px",
  borderRadius: "22px",
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1e3a8a",
  fontSize: "17px",
  lineHeight: 1.7,
  fontWeight: 700,
} as const;

const listStyle = {
  display: "grid",
  gap: "12px",
  fontSize: "17px",
  lineHeight: 1.7,
  color: "#334155",
  fontWeight: 600,
  paddingLeft: "22px",
} as const;

const ctaStyle = {
  marginTop: "44px",
  padding: "30px",
  borderRadius: "26px",
  background: "linear-gradient(135deg, #2563eb, #7c3aed)",
  color: "white",
} as const;

const ctaTitleStyle = {
  fontSize: "28px",
  margin: "0 0 10px",
  letterSpacing: "-0.035em",
  fontWeight: 950,
} as const;

const ctaTextStyle = {
  fontSize: "17px",
  lineHeight: 1.7,
  opacity: 0.94,
  margin: "0 0 20px",
} as const;

const ctaButtonStyle = {
  display: "inline-flex",
  background: "white",
  color: "#1d4ed8",
  textDecoration: "none",
  fontWeight: 950,
  borderRadius: "16px",
  padding: "13px 18px",
} as const;
