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
import shared from "../feature-page.module.css";
import styles from "./page.module.css";

const pageTitle = "Screenshot to Tasks: Turn Screenshots Into Organized Tasks";
const pageDescription =
  "Upload a supported screenshot of a client request and turn it into a reviewable task draft. Edit supported fields, remove unwanted tasks, and save only after approval.";
const pagePath = "/features/screenshot-to-tasks";
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

const problemPoints = [
  "Several instructions can appear in the same conversation.",
  "Important dates and amounts can be buried inside the message.",
  "The original context still matters when the task list is reviewed.",
] as const;

const workflowSteps = [
  {
    title: "Upload or paste one screenshot",
    text: "Choose a supported screenshot containing the client request you want to organize.",
  },
  {
    title: "Review the proposed tasks",
    text: "Text2Task organizes visible instructions and supporting details into a draft.",
  },
  {
    title: "Edit, remove, and save",
    text: "Correct supported fields, remove tasks that do not belong, and save only after you approve the result.",
  },
] as const;

const capabilityItems = [
  "Task instructions",
  "Client or contact details",
  "Deadlines",
  "Priority",
  "Budget or amount",
  "Notes and original context",
] as const;

const audienceLinks = [
  {
    href: "/use-cases/web-designers",
    title: "Web designers",
    text: "Turn screenshots of site-edit requests into a reviewable task draft.",
  },
  {
    href: "/use-cases/graphic-designers",
    title: "Graphic designers",
    text: "Organize screenshots of design feedback and revision requests.",
  },
  {
    href: "/use-cases/social-media-managers",
    title: "Social media managers",
    text: "Turn screenshots of content approvals into clear tasks.",
  },
  {
    href: "/solutions/freelancer-project-management-software",
    title: "Freelancers",
    text: "Keep screenshot-based client requests organized alongside your other work.",
  },
] as const;

const relatedLinks = [
  {
    href: "/features/ai-task-extractor",
    title: "AI Task Extractor",
    text: "Paste text instead of a screenshot to create a project and task draft.",
  },
  {
    href: "/resources/turn-client-messages-into-tasks",
    title: "Turn client messages into tasks",
    text: "Follow a practical workflow for organizing client messages, notes, and screenshots.",
  },
  {
    href: "/solutions/freelancer-project-management-software",
    title: "Freelancer project management software",
    text: "See how projects, tasks, updates, and resources stay connected after intake.",
  },
  {
    href: "/resources/how-to-turn-screenshots-into-tasks",
    title: "How to turn screenshots into tasks",
    text: "Follow a practical workflow for separating tasks, deadlines, amounts, contact details, and context from a client-request screenshot.",
  },
] as const;

const faqs = [
  {
    question: "Does Text2Task connect to WhatsApp or another messaging app?",
    answer:
      "No. You choose the screenshot and upload or paste it into Text2Task yourself. Text2Task does not connect to or monitor WhatsApp, Gmail, Outlook, or another inbox.",
  },
  {
    question: "Can I review the tasks before saving?",
    answer:
      "Yes. Text2Task creates a draft you can review. You can edit supported fields, remove tasks that do not belong, and save only after you approve the result.",
  },
  {
    question: "Can I upload several screenshots at once?",
    answer:
      "The current extraction flow processes one image at a time. Choose the screenshot containing the request you want to organize.",
  },
  {
    question: "Will every detail always be detected?",
    answer:
      "No AI extraction is guaranteed to identify every detail correctly. Review the draft and correct anything that is missing or unclear before saving.",
  },
  {
    question: "Does Text2Task save the screenshot result automatically?",
    answer:
      "No. The result remains a reviewable draft until you choose to save it.",
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
      name: "Screenshot to Tasks",
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

export default function ScreenshotToTasksPage() {
  return (
    <div className={shared.pageShell}>
      <JsonLd id="screenshot-to-tasks-page-jsonld" data={webPageJsonLd} />
      <JsonLd
        id="screenshot-to-tasks-breadcrumb-jsonld"
        data={breadcrumbJsonLd}
      />
      <JsonLd id="screenshot-to-tasks-faq-jsonld" data={faqJsonLd} />

      <LandingHeader />

      <main>
        <section className={shared.hero}>
          <div className={shared.heroInner}>
            <p className={shared.eyebrow}>Screenshot to Tasks</p>
            <h1>Turn screenshots into organized tasks</h1>
            <p className={shared.heroLead}>
              Upload or paste a supported screenshot of a client request.
              Text2Task organizes the visible details into a task draft you
              can review, edit, and approve before saving.
            </p>

            <div className={shared.heroActions}>
              <Link href="/signup" className={shared.primaryButton}>
                Try Text2Task free
              </Link>
              <Link href="#how-it-works" className={shared.secondaryButton}>
                See how it works
              </Link>
            </div>

            <p className={shared.heroNote}>
              You choose what to upload. Text2Task does not connect to your
              messaging or email accounts.
            </p>
          </div>
        </section>

        <section className={styles.visualSection}>
          <div className={styles.visualFrame}>
            <Image
              src="/landing/text2task-upload-screenshot.png"
              alt={ogImageAlt}
              fill
              className={styles.visualImage}
              sizes="(min-width: 900px) 840px, calc(100vw - 40px)"
            />
          </div>
          <p className={styles.visualCaption}>
            Upload or paste the screenshot yourself. Text2Task does not read
            directly from WhatsApp, Gmail, Outlook, or another inbox.
          </p>
        </section>

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <p className={shared.sectionEyebrow}>
              Why screenshots become messy work
            </p>
            <h2>One screenshot can contain several different tasks</h2>
            <p className={shared.sectionLead}>
              Client screenshots often mix requests, corrections, deadlines,
              amounts, contact details, and extra notes in one image.
              Rebuilding every detail manually takes time and makes it
              easier to miss something important.
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
            <h2>From a screenshot to a reviewable task draft</h2>
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
            <p className={shared.sectionEyebrow}>What may be organized</p>
            <h2>Keep the useful details together</h2>
            <p className={shared.sectionLead}>
              When the information is present and readable, the draft may
              include:
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
            Review every result before saving. Details that are missing,
            unclear, or not written in the screenshot may remain
            unspecified.
          </p>
        </section>

        <section className={shared.trustSection}>
          <div className={shared.trustInner}>
            <p className={shared.sectionEyebrow}>You stay in control</p>
            <h2>Nothing is saved automatically</h2>
            <p>
              Text2Task creates a draft for review. You can edit supported
              information, remove tasks that do not belong, and save the
              result only after you approve it.
            </p>
          </div>
        </section>

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <h2>A screenshot may contain one task or several related tasks</h2>
            <p className={shared.sectionLead}>
              A short screenshot may contain one clear request. A longer
              conversation may contain several related tasks, deadlines, and
              supporting details. Text2Task helps separate that work so you
              can review it clearly.
            </p>
          </div>
        </section>

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <p className={shared.sectionEyebrow}>
              Common screenshot workflows
            </p>
            <h2>Useful when client requests arrive as screenshots</h2>
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
            <h2>Screenshot to Tasks questions</h2>
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
            <h2>Turn your next screenshot into a clear task draft</h2>
            <p>
              Upload or paste a supported client-request screenshot, review
              the proposed tasks, and save only the work you approve.
            </p>
          </div>

          <div className={shared.finalActions}>
            <Link href="/signup" className={shared.primaryButtonOnDark}>
              Try Text2Task free
            </Link>
            <Link
              href="/features/ai-task-extractor"
              className={shared.secondaryButtonOnDark}
            >
              Explore AI Task Extractor
            </Link>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
