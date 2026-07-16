import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import LandingFooter from "@/app/components/landing/landing-footer";
import LandingHeader from "@/app/components/landing/landing-header";
import { buildBreadcrumbListJsonLd } from "@/app/lib/schema";
import { absoluteUrl } from "@/app/lib/site-config";
import styles from "./page.module.css";

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
    title: "How to turn emails into tasks",
    description:
      "A practical workflow for turning a detailed client email into a reviewable project, tasks, deadlines, priorities, and supporting details.",
    href: "/resources/how-to-turn-emails-into-tasks",
    tag: "Email workflow",
  },
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
  const resourcesCanonicalUrl = absoluteUrl("/resources");
  const breadcrumbJsonLd = buildBreadcrumbListJsonLd({
    currentCanonicalUrl: resourcesCanonicalUrl,
    items: [
      {
        name: "Home",
        url: absoluteUrl("/"),
      },
      {
        name: "Resources",
        url: resourcesCanonicalUrl,
      },
    ],
  });

  return (
    <div className={styles.pageShell}>
      <JsonLd id="resources-breadcrumb-jsonld" data={breadcrumbJsonLd} />

      <LandingHeader />

      <main>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Text2Task Resources</p>
          <h1>Practical guides for organizing messy client work.</h1>
          <p className={styles.lead}>
            Learn how freelancers, web designers, virtual assistants, and
            small service providers can turn scattered client messages,
            screenshots, notes, deadlines, and budgets into clear tasks.
          </p>
        </section>

        <section className={styles.gridSection}>
          <h2>Explore the guides</h2>

          <div className={styles.articleGrid}>
            {articles.map((article) => (
              <Link
                key={article.href}
                href={article.href}
                className={styles.articleCard}
              >
                <span className={styles.articleTag}>{article.tag}</span>
                <h3>{article.title}</h3>
                <p>{article.description}</p>
                <span className={styles.readGuide}>Read guide &rarr;</span>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.finalCta}>
          <div>
            <h2>Turn messy client messages into organized tasks.</h2>
            <p>
              Paste a client message or upload a screenshot. Text2Task helps
              extract tasks, deadlines, budgets, priorities, client details,
              and notes.
            </p>
          </div>

          <div className={styles.finalActions}>
            <Link href="/signup" className={styles.primaryButton}>
              Try Text2Task free
            </Link>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
