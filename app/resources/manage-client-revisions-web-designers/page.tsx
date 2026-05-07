import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How Web Designers Can Manage Client Revisions Faster",
  description:
    "A practical guide for web designers who want to organize client revisions, screenshots, website edits, deadlines, and feedback faster.",
  alternates: {
    canonical:
      "https://www.text2task.com/resources/manage-client-revisions-web-designers",
  },
};

export default function ArticlePage() {
  return (
    <main style={pageStyle}>
      <article style={articleStyle}>
        <Link href="/resources" style={backLinkStyle}>
          ← Resources
        </Link>

        <p style={eyebrowStyle}>Web designers</p>

        <h1 style={h1Style}>
          How Web Designers Can Manage Client Revisions Faster
        </h1>

        <p style={leadStyle}>
          Website revision requests rarely arrive in a clean format. A client
          may send a screenshot, a WhatsApp message, a list of edits, a deadline,
          and a budget note all in different places. The faster you organize
          those details, the faster you can deliver.
        </p>

        <section style={sectionStyle}>
          <h2 style={h2Style}>The common revision problem</h2>
          <p style={pStyle}>
            Web designers often manage homepage edits, mobile fixes, copy
            changes, pricing sections, contact form issues, and launch notes at
            the same time. When those requests stay inside chat threads, it is
            easy to miss a small but important detail.
          </p>

          <div style={exampleBoxStyle}>
            “Please fix the mobile menu, update the hero text, add the new
            testimonial section, use the logo from my last email, and send the
            first draft by Thursday.”
          </div>

          <p style={pStyle}>
            That message contains several tasks. It also contains a deadline and
            context. A good workflow turns it into clear actions before the
            details disappear in the conversation.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>A better workflow for revisions</h2>
          <ol style={listStyle}>
            <li>Separate each revision into its own task.</li>
            <li>Keep the original client note for context.</li>
            <li>Extract the deadline and priority.</li>
            <li>Group work by client or project.</li>
            <li>Mark each item as new, in progress, or done.</li>
          </ol>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>Where Text2Task fits</h2>
          <p style={pStyle}>
            Text2Task helps web designers turn messy revision messages and
            screenshots into structured tasks. You can review the extracted
            tasks, edit the preview, and save everything into a clean Tasks CRM.
          </p>

          <p style={pStyle}>
            This is especially useful for web designers, WordPress freelancers,
            Webflow freelancers, and small agencies that handle repeated client
            edits.
          </p>
        </section>

        <section style={ctaStyle}>
          <h2 style={ctaTitleStyle}>Turn revisions into clear tasks</h2>
          <p style={ctaTextStyle}>
            Paste a client revision message or upload a screenshot and organize
            the work before details get lost.
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