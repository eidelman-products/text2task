import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import LandingFooter from "@/app/components/landing/landing-footer";
import LandingHeader from "@/app/components/landing/landing-header";
import {
  buildArticleJsonLd,
  buildBreadcrumbListJsonLd,
} from "@/app/lib/schema";
import { absoluteUrl } from "@/app/lib/site-config";
import styles from "../resource-article.module.css";

const articleTitle = "How to Organize Client Requests as a Freelancer";
const articleDescription =
  "Learn how freelancers can organize messy client requests, screenshots, messages, deadlines, budgets, and notes into clear tasks.";
const articlePath =
  "/resources/how-to-organize-client-requests-as-a-freelancer";
const articleUrl = absoluteUrl(articlePath);

export const metadata: Metadata = {
  title: articleTitle,
  description: articleDescription,
  alternates: {
    canonical: articlePath,
  },
  openGraph: {
    title: articleTitle,
    description: articleDescription,
    url: articleUrl,
    siteName: "Text2Task",
    type: "article",
  },
};

export default function ArticlePage() {
  const breadcrumbJsonLd = buildBreadcrumbListJsonLd({
    currentCanonicalUrl: articleUrl,
    items: [
      {
        name: "Home",
        url: absoluteUrl("/"),
      },
      {
        name: "Resources",
        url: absoluteUrl("/resources"),
      },
      {
        name: articleTitle,
        url: articleUrl,
      },
    ],
  });
  const articleJsonLd = buildArticleJsonLd({
    headline: articleTitle,
    description: articleDescription,
    url: articleUrl,
  });

  return (
    <div className={styles.pageShell}>
      <JsonLd
        id="resource-article-breadcrumb-jsonld"
        data={breadcrumbJsonLd}
      />
      <JsonLd id="resource-article-jsonld" data={articleJsonLd} />

      <LandingHeader />

      <main>
        <article className={styles.article}>
          <Link href="/resources" className={styles.backLink}>
            ← Resources
          </Link>

          <header className={styles.hero}>
            <p className={styles.eyebrow}>Freelancer workflow</p>

            <h1>{articleTitle}</h1>

            <p className={styles.lead}>
              Freelancers rarely receive perfect briefs. Client work often
              arrives as scattered messages, screenshots, emails, voice
              notes, budget comments, and deadline reminders. The challenge
              is turning all of that into clear work you can actually
              manage.
            </p>
          </header>

          <section className={styles.section}>
            <h2>Why client requests become messy</h2>
            <p>
              A client might send one message about the homepage, another
              message with a screenshot, a third message with the deadline,
              and later add a budget or new priority. Nothing is necessarily
              wrong with the client. This is simply how real client
              communication happens.
            </p>

            <blockquote className={styles.exampleBox}>
              “Can you update the homepage, fix the mobile menu, add the new
              pricing section, use the logo I sent on WhatsApp, and send the
              first draft by Friday? Budget is around $850.”
            </blockquote>

            <p>
              Inside that one message there are several useful details:
              tasks, budget, deadline, priority, and client context. If you
              do not structure it quickly, important details can get lost.
            </p>
          </section>

          <section className={styles.section}>
            <h2>A simple workflow for organizing requests</h2>
            <ol className={styles.orderedList}>
              <li>Collect the full client message or screenshot.</li>
              <li>Identify the actual tasks inside the message.</li>
              <li>Pull out the deadline, budget, and priority.</li>
              <li>Add client details and notes.</li>
              <li>Save everything in one task workspace.</li>
            </ol>

            <p>
              You can do this manually with a spreadsheet, Notion, Trello,
              or a CRM. The important part is not the tool itself — it is
              the habit of turning scattered communication into structured
              work.
            </p>
          </section>

          <section className={styles.section}>
            <h2>How Text2Task helps</h2>
            <p>
              Text2Task helps freelancers turn messy client messages and
              screenshots into organized tasks. Paste a message or upload a
              screenshot, review the structured preview, edit supported
              fields, remove anything that does not belong, and save the
              approved result to your Tasks CRM.
            </p>

            <p>
              The goal is not to replace your judgment. The goal is to save
              time at the moment where work usually becomes messy: the
              moment a client sends a request.
            </p>
            <p>
              <Link href="/features/ai-task-extractor">
                See how the AI Task Extractor works
              </Link>{" "}
              to turn a pasted client request into a reviewable project and
              task draft.
            </p>
          </section>

          <section className={styles.finalCta}>
            <div className={styles.finalCtaContent}>
              <h2>Try organizing your first client request</h2>
              <p>
                Paste a messy client message or upload a screenshot and turn
                it into structured tasks with deadline, budget, priority,
                client details, and notes.
              </p>
            </div>

            <Link href="/signup" className={styles.primaryButton}>
              Try Text2Task free
            </Link>
          </section>
        </article>
      </main>

      <LandingFooter />
    </div>
  );
}
