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

const pageTitle = "AI Task Extractor: Extract Tasks and Action Items From Text";
const pageDescription =
  "Paste notes, client messages, or other text to create a reviewable project and task draft. Edit supported fields, remove tasks, and save only after approval.";
const pagePath = "/features/ai-task-extractor";
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

const exampleInputText =
  "Website refresh for Acme. Update the hero copy, fix the mobile menu, and add the pricing section. The first draft is due Friday. Budget is $850. Maya Cohen is the client contact.";

const exampleTasks = [
  "Update the hero copy",
  "Fix the mobile menu",
  "Add the pricing section",
] as const;

const problemPoints = [
  "Instructions and background information are mixed together.",
  "Several related tasks may belong to the same project.",
  "Important deadlines, amounts, and client details can be easy to overlook.",
] as const;

const workflowSteps = [
  {
    title: "Paste the text",
    text: "Add the client message, notes, brief, or other text you want to organize.",
  },
  {
    title: "Review the project and tasks",
    text: "Text2Task creates a draft containing project context and related tasks when those details are present.",
  },
  {
    title: "Edit, remove, and save",
    text: "Correct supported information, remove tasks that do not belong, and save only after approval.",
  },
] as const;

const capabilityItems = [
  "Project title and summary",
  "Related tasks",
  "Client and contact information",
  "Deadline",
  "Priority",
  "Budget or amount",
  "Notes and supporting context",
] as const;

const audienceLinks = [
  {
    href: "/use-cases/project-managers",
    title: "Project managers",
    text: "Turn stakeholder notes into a project and task draft you can review.",
  },
  {
    href: "/use-cases/virtual-assistants",
    title: "Virtual assistants",
    text: "Organize detailed instructions without rebuilding every task by hand.",
  },
  {
    href: "/use-cases/small-agencies",
    title: "Small agencies",
    text: "Keep multi-client requests structured before work begins.",
  },
  {
    href: "/solutions/freelancer-project-management-software",
    title: "Freelancers",
    text: "Keep pasted client instructions organized before you start the work.",
  },
] as const;

const relatedLinks = [
  {
    href: "/features/screenshot-to-tasks",
    title: "Screenshot to Tasks",
    text: "Upload or paste a screenshot instead of typed text.",
  },
  {
    href: "/features/email-to-tasks",
    title: "Email to Tasks",
    text: "Paste email text to create a reviewable project and task draft.",
  },
  {
    href: "/resources/how-to-organize-client-requests-as-a-freelancer",
    title: "How to organize client requests as a freelancer",
    text: "A practical workflow for turning scattered client requests into organized work.",
  },
  {
    href: "/resources/how-to-extract-action-items-from-text",
    title: "How to extract action items from text",
    text: "Follow a practical workflow for separating action items from project context, dates, amounts, and client details.",
  },
] as const;

const faqs = [
  {
    question: "What text can I paste into the AI Task Extractor?",
    answer:
      "You can paste client messages, notes, briefs, meeting notes, or other unstructured text containing work you want to organize.",
  },
  {
    question: "Can it extract several tasks from one message?",
    answer:
      "Yes. When the text contains several related instructions, the draft may include multiple tasks organized under the available project context.",
  },
  {
    question: "Can it identify deadlines, priorities, and budgets?",
    answer:
      "It can identify those details when they are present in the source text. Review the draft because missing or unclear information may remain unspecified.",
  },
  {
    question: "Can I edit the extracted tasks?",
    answer:
      "Yes. You can review the draft, edit supported fields, remove tasks that do not belong, and save only after approval.",
  },
  {
    question: "Does Text2Task save or assign tasks automatically?",
    answer:
      "No. Text2Task creates a reviewable draft. It does not save, assign, notify, or create calendar events automatically.",
  },
  {
    question: "Is every extraction guaranteed to be accurate?",
    answer:
      "No. AI extraction can miss or misunderstand details, so every draft should be reviewed before saving.",
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
      name: "AI Task Extractor",
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

export default function AiTaskExtractorPage() {
  return (
    <div className={shared.pageShell}>
      <JsonLd id="ai-task-extractor-page-jsonld" data={webPageJsonLd} />
      <JsonLd
        id="ai-task-extractor-breadcrumb-jsonld"
        data={breadcrumbJsonLd}
      />
      <JsonLd id="ai-task-extractor-faq-jsonld" data={faqJsonLd} />

      <LandingHeader />

      <main>
        <section className={shared.hero}>
          <div className={shared.heroInner}>
            <p className={shared.eyebrow}>AI Task Extractor</p>
            <h1>Extract tasks and action items from text</h1>
            <p className={shared.heroLead}>
              Paste client messages, notes, or other unstructured text.
              Text2Task organizes project context and related tasks into a
              draft you can review before saving.
            </p>

            <div className={shared.heroActions}>
              <Link href="/signup" className={shared.primaryButton}>
                Try Text2Task free
              </Link>
              <Link href="#example" className={shared.secondaryButton}>
                See an example
              </Link>
            </div>

            <p className={shared.heroNote}>
              The draft stays under your control. Review and approve it
              before saving.
            </p>
          </div>
        </section>

        <section id="example" className={styles.exampleSection}>
          <div className={styles.exampleGrid}>
            <div className={styles.exampleColumn}>
              <h3>Pasted text</h3>
              <p className={styles.exampleInputBox}>{exampleInputText}</p>
            </div>

            <div className={styles.exampleArrow} aria-hidden="true">
              &rarr;
            </div>

            <div className={styles.exampleColumn}>
              <h3>Reviewable project and task draft</h3>
              <dl className={styles.exampleOutputPanel}>
                <div className={styles.exampleResultRow}>
                  <dt>Project</dt>
                  <dd>Acme website refresh</dd>
                </div>
                <div className={styles.exampleResultRow}>
                  <dt>Tasks</dt>
                  <dd>
                    <ul className={styles.exampleResultTasks}>
                      {exampleTasks.map((task) => (
                        <li key={task}>{task}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
                <div className={styles.exampleResultRow}>
                  <dt>Deadline</dt>
                  <dd>Friday</dd>
                </div>
                <div className={styles.exampleResultRow}>
                  <dt>Budget</dt>
                  <dd>$850</dd>
                </div>
                <div className={styles.exampleResultRow}>
                  <dt>Client contact</dt>
                  <dd>Maya Cohen</dd>
                </div>
                <div className={styles.exampleResultRow}>
                  <dt>Priority</dt>
                  <dd>Not specified</dd>
                </div>
              </dl>
            </div>
          </div>

          <p className={styles.exampleNote}>
            This is an illustrative example. Actual results depend on the
            text you paste and may vary.
          </p>
        </section>

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <p className={shared.sectionEyebrow}>
              From unstructured text to clear work
            </p>
            <h2>Action items are often mixed with project context</h2>
            <p className={shared.sectionLead}>
              A client message or note may contain the work itself,
              background information, dates, amounts, and contact details
              in the same paragraph. A simple task list can lose that
              context, while manual restructuring takes additional time.
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

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <p className={shared.sectionEyebrow}>How it works</p>
            <h2>Paste, review, and save</h2>
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
            <p className={shared.sectionEyebrow}>What the draft may include</p>
            <h2>More than a basic to-do list</h2>
            <p className={shared.sectionLead}>
              Depending on what is written in the source text, the draft
              may include:
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
            Information that is not present in the source text should not
            be invented. Review the result before saving.
          </p>
        </section>

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <h2>A task extractor should preserve the bigger picture</h2>
            <p className={shared.sectionLead}>
              Some text contains one clear action item. Other text
              describes a complete piece of client work with several
              related tasks. Text2Task keeps those tasks together with the
              available project context instead of returning only an
              isolated checklist.
            </p>
          </div>
        </section>

        <section className={shared.trustSection}>
          <div className={shared.trustInner}>
            <p className={shared.sectionEyebrow}>Review before saving</p>
            <h2>AI creates the draft. You approve the work.</h2>
            <p>
              Edit supported fields, remove anything that does not belong,
              and save only after the project and task draft looks correct.
            </p>
          </div>
        </section>

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <p className={shared.sectionEyebrow}>Who uses text extraction</p>
            <h2>Useful wherever detailed instructions become work</h2>
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
            <h2>Related ways to organize incoming work</h2>
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
            <h2>AI Task Extractor questions</h2>
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
            <h2>Turn unstructured text into a project and task draft</h2>
            <p>
              Paste a client message or note, review the organized project
              and tasks, and save only the result you approve.
            </p>
          </div>

          <div className={shared.finalActions}>
            <Link href="/signup" className={shared.primaryButtonOnDark}>
              Try Text2Task free
            </Link>
            <Link
              href="/features/screenshot-to-tasks"
              className={shared.secondaryButtonOnDark}
            >
              Explore Screenshot to Tasks
            </Link>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
