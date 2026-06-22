import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/app/lib/site-config";

export const metadata: Metadata = {
  title: "Resources for Freelancers",
  description:
    "Practical guides for freelancers and small service providers on organizing client requests, revisions, messages, screenshots, deadlines, and tasks.",
  alternates: {
    canonical: "/resources",
  },
  openGraph: {
    title: "Text2Task Resources",
    description:
      "Guides for freelancers who want to turn messy client messages into organized tasks.",
    url: absoluteUrl("/resources"),
    type: "website",
  },
};

const articles = [
  {
    title: "How to Organize Client Requests as a Freelancer",
    description:
      "A simple workflow for turning scattered client messages, screenshots, notes, deadlines, and budgets into organized work.",
    href: "/resources/how-to-organize-client-requests-as-a-freelancer",
    tag: "Freelancer workflow",
  },
  {
    title: "How Web Designers Can Manage Client Revisions Faster",
    description:
      "How web designers can organize edits, screenshots, client feedback, launch notes, and revision requests without losing details.",
    href: "/resources/manage-client-revisions-web-designers",
    tag: "Web designers",
  },
  {
    title: "Turn Client Messages Into Tasks: A Simple Workflow for Freelancers",
    description:
      "A practical guide to converting messy client conversations into structured tasks with deadlines, budgets, priorities, and notes.",
    href: "/resources/turn-client-messages-into-tasks",
    tag: "Client messages",
  },
];

export default function ResourcesPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "linear-gradient(180deg, #f8fbff 0%, #ffffff 42%, #f8fafc 100%)",
        color: "#0f172a",
        padding: "56px 18px 80px",
      }}
    >
      <section
        style={{
          maxWidth: "1080px",
          margin: "0 auto",
        }}
      >
        <Link
          href="/"
          style={{
            color: "#2563eb",
            textDecoration: "none",
            fontWeight: 800,
            fontSize: "15px",
          }}
        >
          ← Back to Text2Task
        </Link>

        <div
          style={{
            marginTop: "42px",
            maxWidth: "780px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              border: "1px solid #dbeafe",
              background: "#eff6ff",
              color: "#1d4ed8",
              borderRadius: "999px",
              padding: "8px 14px",
              fontSize: "14px",
              fontWeight: 800,
              marginBottom: "20px",
            }}
          >
            Text2Task Resources
          </div>

          <h1
            style={{
              fontSize: "clamp(38px, 6vw, 68px)",
              lineHeight: 1.03,
              letterSpacing: "-0.055em",
              margin: "0 0 18px",
              fontWeight: 950,
            }}
          >
            Practical guides for organizing messy client work.
          </h1>

          <p
            style={{
              fontSize: "20px",
              lineHeight: 1.75,
              color: "#475569",
              margin: 0,
              maxWidth: "720px",
              fontWeight: 500,
            }}
          >
            Learn how freelancers, web designers, virtual assistants, and small
            service providers can turn scattered client messages, screenshots,
            notes, deadlines, and budgets into clear tasks.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
            gap: "22px",
            marginTop: "44px",
          }}
        >
          {articles.map((article) => (
            <Link
              key={article.href}
              href={article.href}
              style={{
                display: "block",
                padding: "28px",
                borderRadius: "28px",
                border: "1px solid #e2e8f0",
                background: "rgba(255,255,255,0.92)",
                boxShadow: "0 20px 60px rgba(15, 23, 42, 0.08)",
                textDecoration: "none",
                color: "#0f172a",
              }}
            >
              <div
                style={{
                  color: "#4f46e5",
                  fontSize: "13px",
                  fontWeight: 900,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: "14px",
                }}
              >
                {article.tag}
              </div>

              <h2
                style={{
                  fontSize: "25px",
                  lineHeight: 1.16,
                  letterSpacing: "-0.03em",
                  margin: "0 0 14px",
                  fontWeight: 950,
                }}
              >
                {article.title}
              </h2>

              <p
                style={{
                  color: "#64748b",
                  fontSize: "16px",
                  lineHeight: 1.7,
                  margin: "0 0 22px",
                  fontWeight: 500,
                }}
              >
                {article.description}
              </p>

              <span
                style={{
                  color: "#2563eb",
                  fontWeight: 900,
                  fontSize: "15px",
                }}
              >
                Read guide →
              </span>
            </Link>
          ))}
        </div>

        <section
          style={{
            marginTop: "56px",
            padding: "34px",
            borderRadius: "30px",
            background: "linear-gradient(135deg, #2563eb, #7c3aed)",
            color: "white",
            boxShadow: "0 24px 70px rgba(37, 99, 235, 0.24)",
          }}
        >
          <h2
            style={{
              margin: "0 0 10px",
              fontSize: "32px",
              letterSpacing: "-0.04em",
              fontWeight: 950,
            }}
          >
            Turn messy client messages into organized tasks.
          </h2>

          <p
            style={{
              margin: "0 0 22px",
              fontSize: "18px",
              lineHeight: 1.7,
              opacity: 0.92,
              maxWidth: "720px",
              fontWeight: 500,
            }}
          >
            Paste a client message or upload a screenshot. Text2Task helps
            extract tasks, deadlines, budgets, priorities, client details, and
            notes.
          </p>

          <Link
            href="/signup"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "white",
              color: "#1d4ed8",
              textDecoration: "none",
              fontWeight: 950,
              borderRadius: "16px",
              padding: "14px 20px",
              boxShadow: "0 14px 30px rgba(15, 23, 42, 0.18)",
            }}
          >
            Try Text2Task free
          </Link>
        </section>
      </section>
    </main>
  );
}
