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
import styles from "./page.module.css";

const pageTitle = "How to Turn Screenshots Into Tasks: A Practical Workflow";
const pageDescription =
  "Learn how to turn a client-request screenshot into a reviewable task draft while preserving deadlines, amounts, contact details, and original context.";
const pagePath = "/resources/how-to-turn-screenshots-into-tasks";
const pageUrl = absoluteUrl(pagePath);
const ogImagePath = "/landing/text2task-upload-screenshot.png";
const ogImageUrl = absoluteUrl(ogImagePath);
const ogImageAlt =
  "Text2Task upload screen with a client-request screenshot ready to be organized into a reviewable task draft.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: pagePath,
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: pageUrl,
    siteName: "Text2Task",
    type: "article",
    images: [
      {
        url: ogImageUrl,
        alt: ogImageAlt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: [
      {
        url: ogImageUrl,
        alt: ogImageAlt,
      },
    ],
  },
};

const problemPoints = [
  "Several instructions may appear in the same conversation.",
  "Important details can be buried between unrelated sentences.",
  "Rewriting the request manually can remove useful context.",
] as const;

const resultTasks = [
  "Update the homepage hero",
  "Fix the mobile menu",
  "Add the pricing section",
] as const;

const workflowSteps = [
  {
    title: "Choose the relevant screenshot",
    text: "Use the image containing the request you want to organize. The current extraction flow processes one image at a time.",
  },
  {
    title: "Read the complete request before separating tasks",
    text: "Look for instructions, dates, amounts, client details, and notes that affect the work.",
  },
  {
    title: "Separate each instruction into a clear task",
    text: "Keep related instructions distinct without removing their shared context.",
  },
  {
    title: "Mark unspecified information honestly",
    text: "Do not invent a deadline, priority, amount, or contact detail that is not present in the screenshot.",
  },
  {
    title: "Review before saving",
    text: "Correct supported fields, remove tasks that do not belong, and save only after the draft looks right.",
  },
] as const;

const mistakes = [
  "Treating the entire screenshot as one long task",
  "Inventing priority when the client did not state urgency",
  "Removing the original request before the draft is reviewed",
  "Assuming every visible detail will always be detected correctly",
] as const;

const relatedGuides = [
  {
    href: "/resources/how-to-extract-action-items-from-text",
    title: "How to extract action items from text",
    text: "A practical workflow for separating action items, project context, dates, and client details from unstructured text.",
  },
  {
    href: "/resources/turn-client-messages-into-tasks",
    title: "Turn client messages into tasks",
    text: "Use the same structured approach for client messages, notes, and screenshots.",
  },
] as const;

const articleJsonLd = buildArticleJsonLd({
  headline: pageTitle,
  description: pageDescription,
  url: pageUrl,
});

const breadcrumbJsonLd = buildBreadcrumbListJsonLd({
  currentCanonicalUrl: pageUrl,
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
      name: pageTitle,
      url: pageUrl,
    },
  ],
});

export default function HowToTurnScreenshotsIntoTasksPage() {
  return (
    <div className={styles.pageShell}>
      <JsonLd
        id="how-to-turn-screenshots-into-tasks-article-jsonld"
        data={articleJsonLd}
      />
      <JsonLd
        id="how-to-turn-screenshots-into-tasks-breadcrumb-jsonld"
        data={breadcrumbJsonLd}
      />

      <LandingHeader />

      <main>
        <article className={styles.article}>
          <Link href="/resources" className={styles.backLink}>
            &larr; Back to Resources
          </Link>

          <header className={styles.hero}>
            <p className={styles.eyebrow}>Screenshot workflow</p>
            <h1>
              How to turn screenshots into tasks without losing the
              original request
            </h1>
            <p className={styles.lead}>
              A client-request screenshot may contain several instructions,
              a deadline, an amount, contact information, and useful
              context in one image. A reliable workflow separates that
              information into tasks while keeping the original request
              available for review.
            </p>
          </header>

          <section className={styles.section}>
            <h2>Why screenshots are difficult to organize manually</h2>
            <p>
              Screenshots preserve the original conversation, but they do
              not automatically separate the work inside it. One image may
              mix several requests with supporting notes, dates, amounts,
              and client details.
            </p>

            <div className={styles.pointList}>
              {problemPoints.map((point, index) => (
                <div key={point} className={styles.pointItem}>
                  <span className={styles.pointNumber}>{index + 1}</span>
                  <p>{point}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={`${styles.section} ${styles.sectionWide}`}>
            <p className={styles.eyebrow}>Example</p>
            <h2>Start with the request exactly as it was received</h2>
            <p>
              The example below is synthetic and illustrative&mdash;not a
              connected WhatsApp or inbox view.
            </p>

            <blockquote className={styles.exampleQuote}>
              Please update the homepage hero, fix the mobile menu, and add
              the pricing section. Send the first draft by Friday. Budget
              is $850. Maya Cohen is the client contact.
            </blockquote>

            <p className={styles.exampleNote}>
              This is an illustrative client-request example. Text2Task
              does not connect directly to WhatsApp, Gmail, Outlook, or
              another inbox.
            </p>
          </section>

          <section className={`${styles.section} ${styles.sectionWide}`}>
            <h2>Separate the tasks from the supporting details</h2>

            <dl className={styles.resultPanel}>
              <div className={styles.resultRow}>
                <dt>Tasks</dt>
                <dd>
                  <ul className={styles.resultTaskList}>
                    {resultTasks.map((task) => (
                      <li key={task}>{task}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Deadline</dt>
                <dd>Friday</dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Budget</dt>
                <dd>$850</dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Client contact</dt>
                <dd>Maya Cohen</dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Priority</dt>
                <dd>Not specified</dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Original context</dt>
                <dd>Keep the source request available while reviewing the draft.</dd>
              </div>
            </dl>

            <p className={styles.exampleNote}>
              The result should reflect only information that is present
              and readable in the source request.
            </p>
          </section>

          <section className={styles.section}>
            <p className={styles.eyebrow}>Practical workflow</p>
            <h2>A five-step workflow for turning a screenshot into tasks</h2>

            <ol className={styles.stepList}>
              {workflowSteps.map((step, index) => (
                <li key={step.title} className={styles.stepRow}>
                  <span className={styles.stepNumber}>
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className={`${styles.section} ${styles.sectionWide}`}>
            <h2>Decide whether the screenshot contains one task or several</h2>

            <div className={styles.decisionColumns}>
              <div className={styles.decisionColumn}>
                <h3>One clear task</h3>
                <p>
                  Use one task when the screenshot contains a single action
                  with one clear outcome.
                </p>
              </div>

              <div className={styles.decisionColumn}>
                <h3>Several related tasks</h3>
                <p>
                  Create separate tasks when the screenshot contains
                  multiple actions that still belong to the same client
                  request.
                </p>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2>Common mistakes when organizing screenshot requests</h2>

            <ol className={styles.mistakeList}>
              {mistakes.map((mistake) => (
                <li key={mistake}>{mistake}</li>
              ))}
            </ol>

            <p>
              A reviewable draft is useful because it gives you a chance to
              correct missing or unclear information before saving.
            </p>
          </section>

          <section className={styles.trustSection}>
            <div className={styles.trustInner}>
              <p className={styles.eyebrow}>
                How Text2Task supports the workflow
              </p>
              <h2>Upload the screenshot, then review the task draft</h2>
              <p>
                Text2Task helps organize visible client instructions into a
                reviewable task draft. You can edit supported fields,
                remove tasks that do not belong, and save only after
                approving the result.{" "}
                <Link href="/features/screenshot-to-tasks">
                  Explore Screenshot to Tasks
                </Link>
                .
              </p>

              <p className={styles.trustNote}>
                You choose what to upload. Text2Task does not monitor
                messaging or email accounts.
              </p>
            </div>
          </section>

          <section className={styles.section}>
            <h2>Related guides</h2>

            <div className={styles.relatedGrid}>
              {relatedGuides.map((guide) => (
                <div key={guide.href} className={styles.relatedItem}>
                  <Link href={guide.href} className={styles.relatedLink}>
                    {guide.title}
                    <span aria-hidden="true">&rarr;</span>
                  </Link>
                  <p>{guide.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.finalCta}>
            <div className={styles.finalCtaContent}>
              <h2>Turn your next screenshot into a reviewable task draft</h2>
              <p>
                Upload or paste one supported client-request screenshot,
                review the proposed tasks, and save only the work you
                approve.
              </p>
            </div>

            <div className={styles.finalActions}>
              <Link href="/signup" className={styles.primaryButton}>
                Try Text2Task free
              </Link>
              <Link
                href="/features/screenshot-to-tasks"
                className={styles.secondaryButtonOnDark}
              >
                Explore Screenshot to Tasks
              </Link>
            </div>
          </section>
        </article>
      </main>

      <LandingFooter />
    </div>
  );
}
