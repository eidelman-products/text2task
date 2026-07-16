import type { Metadata } from "next";
import Image from "next/image";
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
import styles from "./page.module.css";

const pageTitle = "Email to Tasks: Turn Emails Into Projects";
const pageDescription =
  "Paste an email into Text2Task to extract a reviewable project, tasks, deadlines, priorities, budget details, and client information before saving.";
const pagePath = "/features/email-to-tasks";
const pageUrl = absoluteUrl(pagePath);
const ogImagePath =
  "/landing/use-cases/project-managers/project-manager-stakeholder-request-project-flow.png";
const ogImageUrl = absoluteUrl(ogImagePath);
const ogTitle = "Email to Tasks: Turn Emails Into Projects | Text2Task";
const ogDescription =
  "Turn selected email text into a reviewable project and organized tasks, then edit the details before saving them to your Text2Task workspace.";
const ogImageAlt =
  "Client request transformed into a reviewable project and organized tasks in Text2Task";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: pagePath,
  },
  openGraph: {
    title: ogTitle,
    description: ogDescription,
    url: pageUrl,
    siteName: "Text2Task",
    type: "website",
    images: [
      {
        url: ogImageUrl,
        width: 1672,
        height: 941,
        alt: ogImageAlt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: ogTitle,
    description: ogDescription,
    images: [
      {
        url: ogImageUrl,
        alt: ogImageAlt,
      },
    ],
  },
};

const problemTopics = [
  {
    title: "Project context",
    text: "Keep the main request and supporting details together.",
  },
  {
    title: "Action items",
    text: "Organize several related requests under one project.",
  },
  {
    title: "Dates and priorities",
    text: "Review detected deadlines and urgency before saving.",
  },
  {
    title: "Budget and client details",
    text: "Keep relevant amount and contact information with the work when present.",
  },
] as const;

const workflowSteps = [
  {
    title: "Paste the email",
    text: "Copy the email text you want to organize and paste it into Text2Task.",
  },
  {
    title: "Review the structured draft",
    text: "Text2Task prepares a project draft with related tasks and any useful details it can identify.",
  },
  {
    title: "Edit and save",
    text: "Correct the fields, remove anything you do not need, and save the approved project and tasks to your workspace.",
  },
] as const;

const capabilityItems = [
  "Project title and summary",
  "Tasks and subtasks",
  "Deadlines",
  "Priorities",
  "Budget or amount details",
  "Client and contact information",
] as const;

const beforeSavingItems = [
  "Edit the project title and summary",
  "Change deadlines, priorities, amounts, and client details",
  "Remove tasks that do not belong",
] as const;

const inboxSeparateItems = [
  "No Gmail connection",
  "No Outlook connection",
  "No inbox monitoring",
] as const;

const transformationRows = [
  {
    email: "Main client request",
    structure: "Project title and summary",
  },
  {
    email: "Several action items",
    structure: "Organized tasks under the project",
  },
  {
    email: "Dates and urgency",
    structure: "Reviewable deadlines and priorities",
  },
  {
    email: "Budget and contact details",
    structure: "Structured project fields when present",
  },
] as const;

const audienceLinks = [
  {
    href: "/solutions/freelancer-project-management-software",
    title: "Freelancers",
    text: "Turn client instructions into a project you can review before starting the work.",
  },
  {
    href: "/use-cases/project-managers",
    title: "Project managers",
    text: "Keep related requests, dates, and priorities together under the right project.",
  },
  {
    href: "/use-cases/virtual-assistants",
    title: "Virtual assistants",
    text: "Organize detailed email instructions without manually rebuilding every task.",
  },
  {
    href: "/use-cases/small-agencies",
    title: "Small agencies",
    text: "Create a clear project draft before assigning and tracking the work.",
  },
] as const;

const relatedLinks = [
  {
    href: "/solutions/freelancer-project-management-software",
    title: "Freelancer project management software",
    text: "See how Text2Task keeps client requests, projects, tasks, updates, history, and resources together.",
  },
  {
    href: "/resources/how-to-turn-emails-into-tasks",
    title: "How to turn emails into tasks",
    text: "Follow a practical workflow for separating project context, action items, dates, priorities, and supporting details from a client email.",
  },
] as const;

const faqs = [
  {
    question: "Can Text2Task turn an email into tasks?",
    answer:
      "Yes. Copy the email text into Text2Task, and it creates a reviewable project draft with related tasks. Review and edit the details before saving.",
  },
  {
    question: "Does Text2Task connect to Gmail or Outlook?",
    answer:
      "No. Text2Task does not connect directly to Gmail or Outlook and does not monitor your inbox. Paste only the email text you choose to process.",
  },
  {
    question: "What information can Text2Task organize from an email?",
    answer:
      "When the information is present, Text2Task can organize the project title and summary, tasks, deadlines, priorities, budget or amount details, and client or contact information.",
  },
  {
    question: "Can I edit the draft before saving?",
    answer:
      "Yes. You can edit supported fields, change deadlines or priorities, and remove tasks before saving the project.",
  },
  {
    question: "What if the email includes several requests?",
    answer:
      "Text2Task can organize several related requests as tasks under the same project. Review the draft to confirm that each request is represented correctly.",
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
      name: "Email to Tasks",
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

export default function EmailToTasksPage() {
  return (
    <div className={styles.pageShell}>
      <JsonLd id="email-to-tasks-page-jsonld" data={webPageJsonLd} />
      <JsonLd id="email-to-tasks-breadcrumb-jsonld" data={breadcrumbJsonLd} />
      <JsonLd id="email-to-tasks-faq-jsonld" data={faqJsonLd} />

      <LandingHeader />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Email to Tasks</p>
              <h1>Turn emails into organized projects and tasks.</h1>
              <p className={styles.heroLead}>
                Paste email text into Text2Task and turn it into a reviewable
                project with organized tasks, deadlines, priorities, budget
                details, and client information.
              </p>

              <div className={styles.heroActions}>
                <Link href="/signup" className={styles.primaryButton}>
                  Start for free
                </Link>
                <Link href="#how-it-works" className={styles.secondaryButton}>
                  See how it works
                </Link>
              </div>

              <p className={styles.ctaNote}>
                No inbox connection. Nothing is saved until you review the
                draft.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.flowGrid}>
            <figure className={styles.flowFigure}>
              <span className={styles.flowLabel}>1. Copy the email text</span>
              <Image
                src="/landing/text2task-client-gmail-request.png"
                alt="Example client email selected for copying into Text2Task"
                width={1672}
                height={941}
                className={styles.image}
                sizes="(min-width: 960px) 44vw, calc(100vw - 40px)"
              />
            </figure>

            <figure className={styles.flowFigure}>
              <span className={styles.flowLabel}>
                2. Review the project draft
              </span>
              <Image
                src="/landing/text2task-ai-project-preview.png"
                alt="Reviewable Text2Task project draft with organized tasks"
                width={959}
                height={909}
                className={styles.image}
                sizes="(min-width: 960px) 36vw, calc(100vw - 40px)"
              />
            </figure>
          </div>

          <p className={styles.flowCaption}>
            Text2Task does not access or monitor your inbox. You paste the
            email content you choose to process.
          </p>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>The intake problem</p>
            <h2>Emails often contain more than one task.</h2>
            <p>
              Client emails rarely contain one clean action. They mix project
              context, requests, dates, urgency, budget details, and client
              information&mdash;details that are easy to lose when you retype
              the work manually.
            </p>
          </div>

          <div className={styles.topicGrid}>
            {problemTopics.map((topic) => (
              <div key={topic.title} className={styles.topicItem}>
                <h3>{topic.title}</h3>
                <p>{topic.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>How it works</p>
            <h2>Turn an email into a project in three steps.</h2>
          </div>

          <div className={styles.stepsRow}>
            {workflowSteps.map((step, index) => (
              <div key={step.title} className={styles.stepColumn}>
                <span className={styles.stepNumber}>{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>What gets organized</p>
            <h2>What Text2Task can organize from an email</h2>
            <p>
              When the details are present, Text2Task can structure them into
              project fields for you to review.
            </p>
          </div>

          <ul className={styles.checklistGrid}>
            {capabilityItems.map((item) => (
              <li key={item}>
                <span className={styles.checkMark} aria-hidden="true">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.controlSection}>
          <div className={styles.controlInner}>
            <div className={styles.sectionHeader}>
              <p className={styles.sectionEyebrow}>Stay in control</p>
              <h2>You stay in control from paste to save.</h2>
              <p>
                Text2Task does not connect to Gmail or Outlook. You choose
                what to paste, review the structured draft, edit the details,
                and save only when it looks right.
              </p>
            </div>

            <div className={styles.controlColumns}>
              <div className={styles.controlColumn}>
                <h3>Before saving</h3>
                <ul className={styles.controlList}>
                  {beforeSavingItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className={styles.controlColumn}>
                <h3>Your inbox stays separate</h3>
                <ul className={styles.controlList}>
                  {inboxSeparateItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <p className={styles.controlNote}>
              Nothing is saved to your Text2Task workspace until you review
              and approve the draft.
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Project context</p>
            <h2>More than a simple email-to-task list</h2>
            <p>
              Many client emails describe a complete piece of work, not one
              isolated action. Text2Task keeps the project context together
              and organizes the related requests under it.
            </p>
          </div>

          <ul className={styles.mappingList}>
            {transformationRows.map((row) => (
              <li key={row.email} className={styles.mappingRow}>
                <span className={styles.mappingFrom}>{row.email}</span>
                <span className={styles.mappingArrow} aria-hidden="true">
                  &rarr;
                </span>
                <span className={styles.mappingTo}>{row.structure}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Who it helps</p>
            <h2>Built for people who manage client work</h2>
            <p>
              Useful when detailed client instructions arrive by email and
              need to become organized work.
            </p>
          </div>

          <div className={styles.audienceGrid}>
            {audienceLinks.map((link) => (
              <div key={link.href} className={styles.audienceItem}>
                <Link href={link.href} className={styles.audienceLink}>
                  {link.title}
                </Link>
                <p>{link.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Keep going</p>
            <h2>Continue organizing client work</h2>
          </div>

          <div className={styles.relatedGrid}>
            {relatedLinks.map((link) => (
              <div key={link.href} className={styles.relatedItem}>
                <Link href={link.href} className={styles.relatedLink}>
                  {link.title}
                  <span aria-hidden="true">&rarr;</span>
                </Link>
                <p>{link.text}</p>
              </div>
            ))}
          </div>

          <Link href="/use-cases" className={styles.exploreLink}>
            Explore all use cases
          </Link>
        </section>

        <section className={styles.faqSection}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>FAQ</p>
            <h2>Email to Tasks questions</h2>
          </div>

          <div className={styles.faqList}>
            {faqs.map((faq) => (
              <details key={faq.question} className={styles.faqItem}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.finalCta}>
          <div>
            <h2>Turn your next email into an organized project.</h2>
            <p>
              Paste the email text, review the draft, and save the project and
              tasks when everything looks right.
            </p>
          </div>

          <div className={styles.finalActions}>
            <Link href="/signup" className={styles.primaryButton}>
              Start for free
            </Link>
            <Link href="/#pricing" className={styles.secondaryButtonOnDark}>
              See pricing
            </Link>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
