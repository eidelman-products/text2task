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

const pageTitle =
  "How to Turn Client Feedback Into Tasks: A Practical Workflow";
const pageDescription =
  "Learn how to turn follow-up client feedback into proposed task and project updates, review each change, and avoid duplicating existing work.";
const pagePath = "/resources/how-to-turn-client-feedback-into-tasks";
const pageUrl = absoluteUrl(pagePath);
const ogImagePath = "/landing/text2task-client-update-review.png";
const ogImageUrl = absoluteUrl(ogImagePath);
const ogImageAlt =
  "Text2Task project update review screen showing a suggested update plan for an existing project.";

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
  "Some instructions create new tasks.",
  "Some instructions modify tasks or project details that already exist.",
  "Some instructions confirm work that is already handled.",
] as const;

const exampleFeedback =
  "The homepage hero is approved. Please mark it done, move the mobile menu deadline to next Friday, add an FAQ section, and use maya@acme.com as the client email. Keep the pricing section as it is.";

const existingProjectTasks = [
  { title: "Update homepage hero", status: "In Progress" },
  { title: "Fix mobile menu", status: "New" },
  { title: "Add pricing section", status: "Done" },
] as const;

const workflowSteps = [
  {
    title: "Open the correct saved project",
    text: "Confirm that the feedback belongs to the project you are about to update.",
  },
  {
    title: "Read the complete follow-up request",
    text: "Identify new instructions, approvals, changed dates, amounts, client details, and repeated requests.",
  },
  {
    title: "Compare the feedback with existing work",
    text: "Separate new tasks from changes to tasks that are already part of the project.",
  },
  {
    title: "Review each proposed change",
    text: "Keep useful suggestions selected, remove anything that does not belong, and correct supported details.",
  },
  {
    title: "Apply only the approved updates",
    text: "Save only after the proposed plan accurately represents the client's follow-up request.",
  },
] as const;

const mistakes = [
  "Treating every follow-up message as a completely new project",
  "Adding another task for work that already exists",
  "Applying every suggestion without checking the current project",
  "Inventing dates, priorities, budgets, or client details that were not stated",
] as const;

const relatedGuides = [
  {
    href: "/resources/manage-client-revisions-web-designers",
    title: "Manage client revisions faster",
    text: "A focused workflow for organizing repeated client revision requests.",
  },
  {
    href: "/resources/how-to-extract-action-items-from-text",
    title: "How to extract action items from text",
    text: "A practical workflow for separating action items from project context in unstructured text.",
  },
  {
    href: "/resources/turn-client-messages-into-tasks",
    title: "Turn client messages into tasks",
    text: "Use the same structured approach for a first client message.",
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

export default function HowToTurnClientFeedbackIntoTasksPage() {
  return (
    <div className={styles.pageShell}>
      <JsonLd
        id="how-to-turn-client-feedback-into-tasks-article-jsonld"
        data={articleJsonLd}
      />
      <JsonLd
        id="how-to-turn-client-feedback-into-tasks-breadcrumb-jsonld"
        data={breadcrumbJsonLd}
      />

      <LandingHeader />

      <main>
        <article className={styles.article}>
          <Link href="/resources" className={styles.backLink}>
            &larr; Back to Resources
          </Link>

          <header className={styles.hero}>
            <p className={styles.eyebrow}>Client update workflow</p>
            <h1>
              How to turn client feedback into actionable project updates
            </h1>
            <p className={styles.lead}>
              Follow-up client feedback is different from the first project
              request. It may add work, change an existing task, approve
              something already completed, or repeat an instruction that is
              already part of the project.
            </p>
          </header>

          <section className={styles.section}>
            <h2>
              Why follow-up feedback should not be treated as a new project
            </h2>
            <p>
              Once work has started, a new client message needs to be
              compared with the project that already exists. The goal is
              to identify what changed without rebuilding the project or
              adding duplicate tasks.
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
            <h2>Start with the follow-up update and the current project</h2>

            <div className={styles.exampleGrid}>
              <blockquote className={styles.exampleQuote}>
                {exampleFeedback}
              </blockquote>

              <div className={styles.contextPanel}>
                <h3>Project</h3>
                <p className={styles.contextProjectName}>
                  Acme website refresh
                </p>
                <ul className={styles.contextTaskList}>
                  {existingProjectTasks.map((task) => (
                    <li key={task.title}>
                      <span>{task.title}</span>
                      <span className={styles.contextTaskStatus}>
                        {task.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className={styles.exampleNote}>
              This is an illustrative example. The update must be reviewed
              against the actual saved project before any change is
              applied.
            </p>
          </section>

          <section className={`${styles.section} ${styles.sectionWide}`}>
            <h2>Separate new work, changed work, and already-handled work</h2>

            <dl className={styles.resultPanel}>
              <div className={styles.resultRow}>
                <dt>New task</dt>
                <dd>Create FAQ section</dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Existing-task update</dt>
                <dd>Mark &ldquo;Update homepage hero&rdquo; as Done</dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Deadline change</dt>
                <dd>Move &ldquo;Fix mobile menu&rdquo; to next Friday</dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Client-detail change</dt>
                <dd>Set the client email to maya@acme.com</dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Already handled</dt>
                <dd>
                  The pricing-section task already exists and does not need
                  another copy
                </dd>
              </div>
            </dl>

            <p className={styles.exampleNote}>
              The suggested result should reflect the follow-up update and
              the current project without inventing missing information.
            </p>
          </section>

          <section className={styles.section}>
            <p className={styles.eyebrow}>Practical workflow</p>
            <h2>
              A five-step workflow for turning client feedback into project
              updates
            </h2>

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
              Decide whether the feedback creates new work or changes
              existing work
            </h2>

            <div className={styles.decisionColumns}>
              <div className={styles.decisionColumn}>
                <h3>New task</h3>
                <p>
                  Use a new task when the feedback introduces a distinct
                  action that is not already part of the project.
                </p>
              </div>

              <div className={styles.decisionColumn}>
                <h3>Update to existing work</h3>
                <p>
                  Update an existing item when the feedback changes its
                  status, deadline, priority, amount, wording, or related
                  client information.
                </p>
              </div>
            </div>

            <p className={styles.exampleNote}>
              Repeated or already-completed work should not automatically
              become another task.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Common mistakes when organizing client feedback</h2>

            <ol className={styles.mistakeList}>
              {mistakes.map((mistake) => (
                <li key={mistake}>{mistake}</li>
              ))}
            </ol>

            <p>
              The purpose of a review workflow is to reduce manual
              restructuring without removing user judgment.
            </p>
          </section>

          <section className={styles.trustSection}>
            <div className={styles.trustInner}>
              <p className={styles.eyebrow}>
                How Text2Task supports the workflow
              </p>
              <h2>Compare the update with the existing project before saving</h2>
              <p>
                Text2Task lets you add a follow-up message or one supported
                screenshot to an existing saved project. It creates a
                suggested update plan that you can review, edit, select,
                and apply only after approval.{" "}
                <Link href="/features/client-feedback-to-tasks">
                  Explore Client Feedback to Tasks
                </Link>
                .
              </p>

              <p className={styles.trustNote}>
                Text2Task does not monitor messaging or email accounts, and
                it does not apply project changes automatically.
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
              <h2>Turn follow-up feedback into reviewed project updates</h2>
              <p>
                Open the saved project, add the client update, review the
                suggested changes, and apply only what belongs.
              </p>
            </div>

            <div className={styles.finalActions}>
              <Link href="/signup" className={styles.primaryButton}>
                Try Text2Task free
              </Link>
              <Link
                href="/features/client-feedback-to-tasks"
                className={styles.secondaryButtonOnDark}
              >
                Explore Client Feedback to Tasks
              </Link>
            </div>
          </section>
        </article>
      </main>

      <LandingFooter />
    </div>
  );
}
