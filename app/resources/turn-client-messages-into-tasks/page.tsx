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

const articleTitle =
  "Turn Client Messages Into Tasks: A Simple Workflow for Freelancers";
const articleDescription =
  "Learn a simple workflow for turning messy client messages, screenshots, budgets, deadlines, and notes into organized tasks.";
const articlePath = "/resources/turn-client-messages-into-tasks";
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
            <p className={styles.eyebrow}>Client messages</p>

            <h1>{articleTitle}</h1>

            <p className={styles.lead}>
              Client messages are not always organized. They often include
              tasks, questions, screenshots, deadlines, budgets, and notes
              in one long conversation. A reliable workflow helps you turn
              that message into action.
            </p>
          </header>

          <section className={styles.section}>
            <h2>Start with the raw message</h2>
            <p>
              Do not try to rewrite the request immediately. First, collect
              the original message, email, screenshot, or note. Keeping the
              raw context helps prevent misunderstandings later.
            </p>

            <blockquote className={styles.exampleBox}>
              “Can you create three homepage options, update the pricing
              section, fix the contact form, and send the first version by
              next Friday? Budget is $600.”
            </blockquote>
          </section>

          <section className={styles.section}>
            <h2>Extract the useful fields</h2>
            <p>
              A messy message becomes manageable when you extract the right
              fields:
            </p>

            <ul className={styles.unorderedList}>
              <li>Client name</li>
              <li>Task details</li>
              <li>Deadline</li>
              <li>Budget or amount</li>
              <li>Priority</li>
              <li>Notes and context</li>
            </ul>

            <p>
              Once these fields are clear, the work becomes easier to
              track, estimate, delegate, and complete.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Save the work somewhere structured</h2>
            <p>
              The final step is saving the extracted work in a place you
              can return to. For some freelancers this is a spreadsheet.
              For others it is a task manager or CRM. The important part is
              that client work does not remain buried inside chat.
            </p>
          </section>

          <section className={styles.section}>
            <h2>How Text2Task speeds this up</h2>
            <p>
              Text2Task helps turn messy client messages and screenshots
              into organized tasks. The AI creates a structured preview,
              and you stay in control by reviewing and editing before
              saving anything.
            </p>
            <p>
              For a message that is mostly plain text,{" "}
              <Link href="/features/ai-task-extractor">
                Explore the AI Task Extractor
              </Link>{" "}
              to see how pasted text becomes a reviewable project and task
              draft.
            </p>
          </section>

          <section className={styles.finalCta}>
            <div className={styles.finalCtaContent}>
              <h2>Try the workflow with your next message</h2>
              <p>
                Paste a messy client message or upload a screenshot and
                turn it into a structured task preview you can review
                before saving.
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
