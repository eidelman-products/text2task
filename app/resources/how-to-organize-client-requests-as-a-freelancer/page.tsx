import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How to Organize Client Requests as a Freelancer",
  description:
    "Learn how freelancers can organize messy client requests, screenshots, messages, deadlines, budgets, and notes into clear tasks.",
  alternates: {
    canonical:
      "https://www.text2task.com/resources/how-to-organize-client-requests-as-a-freelancer",
  },
};

export default function ArticlePage() {
  return (
    <main style={pageStyle}>
      <article style={articleStyle}>
        <Link href="/resources" style={backLinkStyle}>
          ← Resources
        </Link>

        <p style={eyebrowStyle}>Freelancer workflow</p>

        <h1 style={h1Style}>How to Organize Client Requests as a Freelancer</h1>

        <p style={leadStyle}>
          Freelancers rarely receive perfect briefs. Client work often arrives
          as scattered messages, screenshots, emails, voice notes, budget
          comments, and deadline reminders. The challenge is turning all of that
          into clear work you can actually manage.
        </p>

        <section style={sectionStyle}>
          <h2 style={h2Style}>Why client requests become messy</h2>
          <p style={pStyle}>
            A client might send one message about the homepage, another message
            with a screenshot, a third message with the deadline, and later add a
            budget or new priority. Nothing is necessarily wrong with the
            client. This is simply how real client communication happens.
          </p>

          <div style={exampleBoxStyle}>
            “Can you update the homepage, fix the mobile menu, add the new
            pricing section, use the logo I sent on WhatsApp, and send the first
            draft by Friday? Budget is around $850.”
          </div>

          <p style={pStyle}>
            Inside that one message there are several useful details: tasks,
            budget, deadline, priority, and client context. If you do not
            structure it quickly, important details can get lost.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>A simple workflow for organizing requests</h2>
          <ol style={listStyle}>
            <li>Collect the full client message or screenshot.</li>
            <li>Identify the actual tasks inside the message.</li>
            <li>Pull out the deadline, budget, and priority.</li>
            <li>Add client details and notes.</li>
            <li>Save everything in one task workspace.</li>
          </ol>

          <p style={pStyle}>
            You can do this manually with a spreadsheet, Notion, Trello, or a
            CRM. The important part is not the tool itself — it is the habit of
            turning scattered communication into structured work.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>How Text2Task helps</h2>
          <p style={pStyle}>
            Text2Task helps freelancers turn messy client messages and
            screenshots into organized tasks. Paste a message or upload a
            screenshot, review the structured preview, edit anything you want,
            and save the result to your Tasks CRM.
          </p>

          <p style={pStyle}>
            The goal is not to replace your judgment. The goal is to save time
            at the moment where work usually becomes messy: the moment a client
            sends a request.
          </p>
        </section>

        <section style={ctaStyle}>
          <h2 style={ctaTitleStyle}>Try organizing your first client request</h2>
          <p style={ctaTextStyle}>
            Paste a messy client message or upload a screenshot and turn it into
            structured tasks with deadline, budget, priority, client details,
            and notes.
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