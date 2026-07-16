import type { Metadata } from "next";
import Link from "next/link";
import JsonLd, { type JsonLdObject } from "@/app/components/JsonLd";
import LandingFooter from "@/app/components/landing/landing-footer";
import LandingHeader from "@/app/components/landing/landing-header";
import {
  SITE_SCHEMA_ENTITY_IDS,
  buildBreadcrumbListJsonLd,
  buildWebPageEntityId,
} from "@/app/lib/schema";
import { absoluteUrl } from "@/app/lib/site-config";
import shared from "../feature-page.module.css";
import styles from "./page.module.css";

const pageTitle = "Client Feedback to Tasks: Review Project Updates";
const pageDescription =
  "Add a follow-up client message or screenshot to an existing Text2Task project, review proposed changes, and save only the updates you approve.";
const pagePath = "/features/client-feedback-to-tasks";
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
    type: "website",
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

const existingProjectTasks = [
  { title: "Update homepage hero", status: "In Progress" },
  { title: "Fix mobile menu", status: "New" },
  { title: "Add pricing section", status: "Done" },
] as const;

const exampleUpdateText =
  "The homepage hero is approved. Please mark it done, move the mobile menu deadline to next Friday, add an FAQ section, and use maya@acme.com as the client email. Keep the pricing section as it is.";

const selectedChanges = [
  'Mark "Update homepage hero" as Done',
  "Change the mobile-menu deadline to next Friday",
  'Add "Create FAQ section"',
  "Update the client email to maya@acme.com",
] as const;

const alreadyHandled = [
  "The pricing-section task already exists and does not need to be duplicated",
] as const;

const problemPoints = [
  "New instructions may belong beside tasks that already exist.",
  "Some feedback changes existing work instead of creating a new task.",
  "Repeated requests should be recognized before another task is added.",
] as const;

const workflowSteps = [
  {
    title: "Open an existing saved project",
    text: "Choose the Text2Task project that the new client feedback belongs to.",
  },
  {
    title: "Add the follow-up update",
    text: "Paste the client message or provide one supported screenshot.",
  },
  {
    title: "Review the suggested update plan",
    text: "Compare proposed tasks, field changes, and already-handled findings with the current project.",
  },
  {
    title: "Select and edit the changes",
    text: "Deselect anything that should not be applied and correct supported values when needed.",
  },
  {
    title: "Save only the approved updates",
    text: "The selected changes are applied together and appear in the project's update history.",
  },
] as const;

const capabilityItems = [
  "New related tasks",
  "Updates to existing tasks",
  "Task-status changes",
  "Deadline changes",
  "Priority changes",
  "Budget or amount changes",
  "Client-detail changes",
  "Notes and supporting context",
  "Items that appear to be already handled",
] as const;

const controlPoints = [
  "Nothing is applied during analysis.",
  "Already-handled findings are kept outside the selected changes.",
  "The final save requires an explicit user action.",
] as const;

const audienceLinks = [
  {
    href: "/use-cases/web-designers",
    title: "Web designers",
    text: "Keep revision follow-ups connected to the project they belong to.",
  },
  {
    href: "/use-cases/project-managers",
    title: "Project managers",
    text: "Compare stakeholder follow-ups with the work already in progress.",
  },
  {
    href: "/use-cases/small-agencies",
    title: "Small agencies",
    text: "Review follow-up requests across ongoing client projects.",
  },
  {
    href: "/solutions/freelancer-project-management-software",
    title: "Freelancers",
    text: "Keep client feedback connected to the project it changes.",
  },
] as const;

const relatedLinks = [
  {
    href: "/resources/how-to-turn-client-feedback-into-tasks",
    title: "How to turn client feedback into tasks",
    text: "A practical workflow for comparing follow-up feedback with an existing project.",
  },
  {
    href: "/features/ai-task-extractor",
    title: "AI Task Extractor",
    text: "Turn a first client message or note into a new project and task draft.",
  },
  {
    href: "/features/screenshot-to-tasks",
    title: "Screenshot to Tasks",
    text: "Turn a first client-request screenshot into a new task draft.",
  },
  {
    href: "/resources/manage-client-revisions-web-designers",
    title: "Manage client revisions faster",
    text: "A focused workflow for organizing repeated client revision requests.",
  },
] as const;

const faqs = [
  {
    question: "Does Client Feedback to Tasks create a new project?",
    answer:
      "No. This workflow is designed for follow-up feedback connected to an existing saved Text2Task project. For a first request, use the normal text or screenshot extraction workflow.",
  },
  {
    question: "Can I use text or a screenshot?",
    answer:
      "Yes. You can paste a follow-up client message or provide one supported screenshot. The workflow processes one screenshot at a time.",
  },
  {
    question: "Are the suggested changes saved automatically?",
    answer:
      "No. Analysis creates a suggested update plan. Nothing is applied until you review the plan and explicitly save the selected changes.",
  },
  {
    question: "Can I choose which changes to apply?",
    answer:
      "Yes. You can select or deselect individual suggested changes and edit supported values before saving.",
  },
  {
    question: "How does Text2Task handle feedback that is already part of the project?",
    answer:
      "Items that appear to be already handled can be shown separately instead of being selected as new changes. You should still review every result before saving.",
  },
  {
    question: "Is the original screenshot stored in update history?",
    answer:
      "The screenshot is used to analyze the follow-up update, but the original image is not presented as a retained, viewable project file in update history.",
  },
] as const;

const webPageJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": buildWebPageEntityId(pageUrl),
  url: pageUrl,
  name: pageTitle,
  description: pageDescription,
  inLanguage: "en-US",
  isPartOf: {
    "@id": SITE_SCHEMA_ENTITY_IDS.website,
  },
  mainEntity: {
    "@id": SITE_SCHEMA_ENTITY_IDS.softwareApplication,
  },
  publisher: {
    "@id": SITE_SCHEMA_ENTITY_IDS.organization,
  },
} satisfies JsonLdObject;

const breadcrumbJsonLd = buildBreadcrumbListJsonLd({
  currentCanonicalUrl: pageUrl,
  items: [
    {
      name: "Home",
      url: absoluteUrl("/"),
    },
    {
      name: "Features",
      url: absoluteUrl("/#features"),
    },
    {
      name: "Client Feedback to Tasks",
      url: pageUrl,
    },
  ],
});

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${pageUrl}#faq`,
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
} satisfies JsonLdObject;

export default function ClientFeedbackToTasksPage() {
  return (
    <div className={shared.pageShell}>
      <JsonLd id="client-feedback-to-tasks-page-jsonld" data={webPageJsonLd} />
      <JsonLd
        id="client-feedback-to-tasks-breadcrumb-jsonld"
        data={breadcrumbJsonLd}
      />
      <JsonLd id="client-feedback-to-tasks-faq-jsonld" data={faqJsonLd} />

      <LandingHeader />

      <main>
        <section className={shared.hero}>
          <div className={shared.heroInner}>
            <p className={shared.eyebrow}>Client Feedback to Tasks</p>
            <h1>Turn client feedback into reviewable project updates</h1>
            <p className={shared.heroLead}>
              Open an existing Text2Task project, paste a follow-up client
              message or add one supported screenshot, and review the
              proposed changes before anything is saved.
            </p>

            <div className={shared.heroActions}>
              <Link href="/signup" className={shared.primaryButton}>
                Try Text2Task free
              </Link>
              <Link href="#how-it-works" className={shared.secondaryButton}>
                See the workflow
              </Link>
            </div>

            <p className={shared.heroNote}>
              This workflow updates existing saved projects. Every proposed
              change remains under your control.
            </p>
          </div>
        </section>

        <section className={styles.exampleSection}>
          <div className={styles.exampleGrid}>
            <div className={styles.exampleColumn}>
              <h3>Existing project</h3>
              <p className={styles.exampleProjectName}>Acme website refresh</p>
              <ul className={styles.exampleTaskList}>
                {existingProjectTasks.map((task) => (
                  <li key={task.title}>
                    <span>{task.title}</span>
                    <span className={styles.exampleStatus}>
                      {task.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.exampleArrow} aria-hidden="true">
              &rarr;
            </div>

            <div className={styles.exampleColumn}>
              <h3>Follow-up client update</h3>
              <p className={styles.exampleUpdateText}>{exampleUpdateText}</p>
            </div>

            <div className={styles.exampleArrow} aria-hidden="true">
              &rarr;
            </div>

            <div className={styles.exampleColumn}>
              <h3>Suggested update plan</h3>

              <div className={styles.exampleResultGroup}>
                <h4>Selected changes</h4>
                <ul className={styles.exampleSelectedList}>
                  {selectedChanges.map((change) => (
                    <li key={change}>
                      <span className={styles.exampleCheck} aria-hidden="true">
                        &#10003;
                      </span>
                      {change}
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.exampleResultGroup}>
                <h4>Already handled</h4>
                <ul className={styles.exampleHandledList}>
                  {alreadyHandled.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <p className={styles.exampleDisclaimer}>
            This is an illustrative example. Actual suggestions depend on the
            saved project and the follow-up update, and every result should
            be reviewed before saving.
          </p>
        </section>

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <p className={shared.sectionEyebrow}>After the first request</p>
            <h2>Client feedback can change work that is already in progress</h2>
            <p className={shared.sectionLead}>
              A follow-up message may add a task, approve completed work,
              move a deadline, change a priority, update a budget, or repeat
              something that is already part of the project. Rebuilding
              those changes manually can disconnect the feedback from the
              work it belongs to.
            </p>
          </div>

          <div className={shared.pointList}>
            {problemPoints.map((point, index) => (
              <div key={point} className={shared.pointItem}>
                <span className={shared.pointNumber}>{index + 1}</span>
                <p>{point}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className={shared.section}>
          <div className={shared.sectionHeader}>
            <p className={shared.sectionEyebrow}>How it works</p>
            <h2>From follow-up feedback to approved project changes</h2>
          </div>

          <div className={shared.steps}>
            {workflowSteps.map((step, index) => (
              <div key={step.title} className={shared.step}>
                <span className={shared.stepNumber}>{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <p className={shared.sectionEyebrow}>
              What the update may include
            </p>
            <h2>More than a new task</h2>
            <p className={shared.sectionLead}>
              Depending on the follow-up feedback and the existing saved
              project, the suggested plan may include:
            </p>
          </div>

          <ul className={shared.checklist}>
            {capabilityItems.map((item) => (
              <li key={item} className={shared.checklistItem}>
                <span className={shared.checkMark} aria-hidden="true">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>

          <p className={shared.inlineNote}>
            Missing, unclear, or unsupported information should remain
            unchanged until the user reviews it.
          </p>
        </section>

        <section className={shared.trustSection}>
          <div className={shared.trustInner}>
            <p className={shared.sectionEyebrow}>Review before applying</p>
            <h2>You decide which changes belong in the project</h2>
            <p>
              Text2Task creates a suggested update plan. You can select or
              deselect individual changes, edit supported details, and save
              only after the plan matches the client&rsquo;s request.
            </p>

            <ul className={shared.checklist}>
              {controlPoints.map((point) => (
                <li key={point} className={shared.checklistItem}>
                  <span className={shared.checkMark} aria-hidden="true">
                    ✓
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <h2>Keep follow-up work connected to the project</h2>
            <p className={shared.sectionLead}>
              Applied client updates appear in project update history, so
              the project retains a record of what was reviewed and
              changed. Text2Task also checks proposed new tasks against
              existing work before applying them.
            </p>
            <p className={shared.inlineNote}>
              Duplicate checks reduce accidental repetition but do not
              replace user review.
            </p>
          </div>
        </section>

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <p className={shared.sectionEyebrow}>
              Useful for ongoing client work
            </p>
            <h2>Built for projects that continue to change</h2>
          </div>

          <div className={shared.audienceGrid}>
            {audienceLinks.map((link) => (
              <div key={link.href} className={shared.audienceItem}>
                <Link href={link.href} className={shared.audienceLink}>
                  {link.title}
                </Link>
                <p>{link.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <h2>Related ways to organize client work</h2>
          </div>

          <div className={shared.relatedGrid}>
            {relatedLinks.map((link) => (
              <div key={link.href} className={shared.relatedItem}>
                <Link href={link.href} className={shared.relatedLink}>
                  {link.title}
                  <span aria-hidden="true">&rarr;</span>
                </Link>
                <p>{link.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <p className={shared.sectionEyebrow}>FAQ</p>
            <h2>Client Feedback to Tasks questions</h2>
          </div>

          <div className={shared.faqList}>
            {faqs.map((faq) => (
              <details key={faq.question} className={shared.faqItem}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={shared.finalCta}>
          <div className={shared.finalCtaContent}>
            <h2>Turn the next client update into reviewed project changes</h2>
            <p>
              Open an existing project, add the follow-up feedback, review
              the suggested plan, and save only the changes you approve.
            </p>
          </div>

          <div className={shared.finalActions}>
            <Link href="/signup" className={shared.primaryButtonOnDark}>
              Try Text2Task free
            </Link>
            <Link
              href="/resources/how-to-turn-client-feedback-into-tasks"
              className={shared.secondaryButtonOnDark}
            >
              Read the workflow guide
            </Link>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
