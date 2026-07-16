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

const pageTitle = "How to Extract Action Items From Text: A Practical Workflow";
const pageDescription =
  "Learn how to extract action items, deadlines, priorities, amounts, and project context from unstructured text without losing important details.";
const pagePath = "/resources/how-to-extract-action-items-from-text";
const pageUrl = absoluteUrl(pagePath);
const ogImagePath = "/landing/text2task-demo-project-preview-poster.png";
const ogImageUrl = absoluteUrl(ogImagePath);
const ogImageAlt =
  "Text2Task project and task draft shown as an organized result after reviewing pasted text.";

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
  "Action items may depend on the same project context.",
  "Different tasks may have different dates or supporting details.",
  "Information that is not explicitly stated should remain unspecified.",
] as const;

const exampleText =
  "Northstar client onboarding. Send the welcome email, request the brand files, schedule the kickoff call for Tuesday, and prepare the first campaign outline by Thursday. Alex Kim is the client contact.";

const resultTasks = [
  "Send the welcome email",
  "Request the brand files",
  "Schedule the kickoff call",
  "Prepare the first campaign outline",
] as const;

const availableDates = [
  "Kickoff call: Tuesday",
  "Campaign outline: Thursday",
] as const;

const workflowSteps = [
  {
    title: "Read the entire source before listing tasks",
    text: "Understand the purpose of the message, note, or brief before separating individual actions.",
  },
  {
    title: "Identify the actions",
    text: "Look for work that someone needs to complete, review, send, update, prepare, or confirm.",
  },
  {
    title: "Preserve the shared project context",
    text: "Keep related tasks connected to the client, project, or outcome described in the source.",
  },
  {
    title: "Extract only supported details",
    text: "Keep deadlines, priorities, amounts, and contact information only when they are present in the text.",
  },
  {
    title: "Review the draft before saving",
    text: "Edit supported information, remove tasks that do not belong, and save only after approval.",
  },
] as const;

const mistakes = [
  "Extracting only verbs and losing the reason behind the work",
  "Combining several actions into one vague task",
  "Inventing deadlines, priorities, or budgets that were not stated",
  "Saving the result without reviewing missing or misunderstood details",
] as const;

const relatedGuides = [
  {
    href: "/resources/how-to-turn-screenshots-into-tasks",
    title: "How to turn screenshots into tasks",
    text: "Use the same structured approach for a client-request screenshot.",
  },
  {
    href: "/resources/how-to-turn-emails-into-tasks",
    title: "How to turn emails into tasks",
    text: "A practical workflow for separating project context and tasks from a client email.",
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

export default function HowToExtractActionItemsFromTextPage() {
  return (
    <div className={styles.pageShell}>
      <JsonLd
        id="how-to-extract-action-items-from-text-article-jsonld"
        data={articleJsonLd}
      />
      <JsonLd
        id="how-to-extract-action-items-from-text-breadcrumb-jsonld"
        data={breadcrumbJsonLd}
      />

      <LandingHeader />

      <main>
        <article className={styles.article}>
          <Link href="/resources" className={styles.backLink}>
            &larr; Back to Resources
          </Link>

          <header className={styles.hero}>
            <p className={styles.eyebrow}>Action item workflow</p>
            <h1>
              How to extract action items from text without losing project
              context
            </h1>
            <p className={styles.lead}>
              Unstructured text often mixes instructions, background
              information, deadlines, amounts, and client details in the
              same paragraph. A good workflow identifies the action items
              without throwing away the context needed to complete them
              correctly.
            </p>
          </header>

          <section className={styles.section}>
            <h2>Why a basic checklist is not always enough</h2>
            <p>
              A message or set of notes may describe a complete piece of
              client work rather than a collection of unrelated to-do
              items. Extracting only the verbs can remove the client,
              deadline, budget, and reason behind the work.
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
            <h2>Start with the unstructured text</h2>

            <blockquote className={styles.exampleBox}>{exampleText}</blockquote>

            <p className={styles.exampleNote}>
              This is an illustrative example. Actual results depend on the
              source text and should always be reviewed.
            </p>
          </section>

          <section className={`${styles.section} ${styles.sectionWide}`}>
            <h2>Separate action items from project information</h2>

            <dl className={styles.resultPanel}>
              <div className={styles.resultRow}>
                <dt>Project</dt>
                <dd>Northstar client onboarding</dd>
              </div>
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
                <dt>Available dates</dt>
                <dd>
                  <ul className={styles.resultTaskList}>
                    {availableDates.map((date) => (
                      <li key={date}>{date}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Client contact</dt>
                <dd>Alex Kim</dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Budget</dt>
                <dd>Not specified</dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Priority</dt>
                <dd>Not specified</dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Supporting context</dt>
                <dd>The tasks belong to the same client-onboarding project.</dd>
              </div>
            </dl>

            <p className={styles.exampleNote}>
              The structured draft should preserve information that is
              present while leaving missing fields unspecified.
            </p>
          </section>

          <section className={styles.section}>
            <p className={styles.eyebrow}>Practical workflow</p>
            <h2>A five-step workflow for extracting action items from text</h2>

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
            <h2>
              Decide whether the text describes one action item or a
              complete project
            </h2>

            <div className={styles.decisionColumns}>
              <div className={styles.decisionColumn}>
                <h3>One action item</h3>
                <p>
                  Use one task when the source contains one clear action
                  with one expected outcome.
                </p>
              </div>

              <div className={styles.decisionColumn}>
                <h3>A project with related tasks</h3>
                <p>
                  Keep tasks together when the source describes several
                  actions that share the same client, goal, deadline, or
                  supporting context.
                </p>
              </div>
            </div>
          </section>

          <section className={styles.section}>
            <h2>Common mistakes when extracting action items</h2>

            <ol className={styles.mistakeList}>
              {mistakes.map((mistake) => (
                <li key={mistake}>{mistake}</li>
              ))}
            </ol>

            <p>
              The purpose of the workflow is not to remove judgment. It is
              to reduce manual restructuring while keeping the user in
              control.
            </p>
          </section>

          <section className={styles.trustSection}>
            <div className={styles.trustInner}>
              <p className={styles.eyebrow}>
                How Text2Task supports the workflow
              </p>
              <h2>Paste the text, then review the project and task draft</h2>
              <p>
                Text2Task helps organize unstructured text into available
                project context and related tasks. You can edit supported
                fields, remove tasks that do not belong, and save only
                after reviewing the draft.{" "}
                <Link href="/features/ai-task-extractor">
                  Explore AI Task Extractor
                </Link>
                .
              </p>

              <p className={styles.trustNote}>
                Text2Task does not save, assign, notify, or create calendar
                events automatically.
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
              <h2>Turn unstructured text into a project and task draft</h2>
              <p>
                Paste a client message, note, or brief, review the
                organized project and tasks, and save only the result you
                approve.
              </p>
            </div>

            <div className={styles.finalActions}>
              <Link href="/signup" className={styles.primaryButton}>
                Try Text2Task free
              </Link>
              <Link
                href="/features/ai-task-extractor"
                className={styles.secondaryButtonOnDark}
              >
                Explore AI Task Extractor
              </Link>
            </div>
          </section>
        </article>
      </main>

      <LandingFooter />
    </div>
  );
}
