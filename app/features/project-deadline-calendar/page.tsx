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

const pageTitle = "Project Deadline Calendar for Freelancers & Small Teams";
const ogTitle =
  "Project Deadline Calendar for Freelancers & Small Teams | Text2Task";
const pageDescription =
  "Plan project deadlines, client work, and manual events in one clear calendar. Keep projects, clients, and scheduled work organized with Text2Task.";
const pagePath = "/features/project-deadline-calendar";
const pageUrl = absoluteUrl(pagePath);
const ogImagePath =
  "/landing/features/project-deadline-calendar/text2task-project-deadline-calendar.png";
const ogImageUrl = absoluteUrl(ogImagePath);
const ogImageAlt =
  "Text2Task project deadline calendar showing project deadlines and manual client-work events";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: pagePath,
  },
  openGraph: {
    title: ogTitle,
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
    title: ogTitle,
    description: pageDescription,
    images: [
      {
        url: ogImageUrl,
        alt: ogImageAlt,
      },
    ],
  },
};

const deadlinePoints = [
  "View project deadlines in one monthly calendar",
  "See the project, client, status, and priority behind a deadline",
  "Open the related task workspace when more detail is needed",
] as const;

const manualEventPoints = [
  "Add a date, optional time, and notes",
  "Edit or remove manual events",
  "View deadlines and manual events together for the selected day",
] as const;

const linkingPoints = [
  "Search existing projects and clients",
  "Enter a custom project or client name",
  "Automatically use the linked project's client when applicable",
] as const;

const workflowSteps = [
  {
    title: "Add or update project deadlines",
    text: "Add or update project deadlines in Text2Task.",
  },
  {
    title: "Schedule client-work events",
    text: "Schedule manual client-work events when needed.",
  },
  {
    title: "Review the calendar",
    text: "Open the calendar to review deadlines and events by day.",
  },
] as const;

const audienceLinks = [
  {
    href: "/solutions/freelancer-project-management-software",
    title: "Freelancers",
    text: "Plan client calls, reviews, revisions, and delivery dates.",
  },
  {
    href: "/use-cases/small-agencies",
    title: "Small agencies",
    text: "Keep project deadlines and scheduled client work visible across active accounts.",
  },
  {
    href: "/use-cases/project-managers",
    title: "Project managers",
    text: "Review important dates without opening every project separately.",
  },
  {
    href: "/use-cases/web-designers",
    title: "Designers and developers",
    text: "Track review rounds, content handoffs, launches, and final delivery dates.",
  },
] as const;

const faqs = [
  {
    question: "What is a project deadline calendar?",
    answer:
      "A project deadline calendar gives you one calendar view of your project deadlines and scheduled work, along with the project and client context behind each date.",
  },
  {
    question: "Do Text2Task project deadlines appear in the calendar?",
    answer:
      "Yes. Deadlines saved on your Text2Task projects appear in the Work Calendar on their relevant date.",
  },
  {
    question: "Can I add events that are not connected to an existing project?",
    answer:
      "Yes. A manual event can use an existing project and client, or a custom project or client name when the work is not yet in your CRM.",
  },
  {
    question: "Can I edit manual calendar events?",
    answer:
      "Yes. Manual events can be edited or removed. Project deadline details continue to come from the related project or task workspace.",
  },
  {
    question: "Does the Work Calendar work on mobile?",
    answer:
      "Yes. The Work Calendar includes a responsive mobile view and a day-detail dialog suited to smaller screens.",
  },
] as const;

// Exported for direct, non-rendering structured-data regression tests.
export const webPageJsonLd = {
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
  // 2026-08-26 structured-data follow-up fix -- mainEntity used to
  // reference SITE_SCHEMA_ENTITY_IDS.softwareApplication, a SoftwareApplication
  // entity that no page declares any more (removed from app/page.tsx for
  // lacking legitimate aggregateRating/review data). A dangling @id
  // reference to an undeclared entity is not replaced with a different
  // schema merely to fill the field -- WebPage does not require mainEntity.
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
      name: "Work Calendar",
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

export default function ProjectDeadlineCalendarPage() {
  return (
    <div className={shared.pageShell}>
      <JsonLd id="project-deadline-calendar-page-jsonld" data={webPageJsonLd} />
      <JsonLd
        id="project-deadline-calendar-breadcrumb-jsonld"
        data={breadcrumbJsonLd}
      />
      <JsonLd id="project-deadline-calendar-faq-jsonld" data={faqJsonLd} />

      <LandingHeader />

      <main>
        <section className={shared.hero}>
          <div className={shared.heroInner}>
            <p className={shared.eyebrow}>Work Calendar</p>
            <h1>A Project Deadline Calendar Built for Client Work</h1>
            <p className={shared.heroLead}>
              See project deadlines, schedule client work, and add manual
              events in one clear calendar—without losing the project and
              client context behind each date.
            </p>

            <div className={shared.heroActions}>
              <Link href="/signup" className={shared.primaryButton}>
                Start free
              </Link>
              <Link href="/#pricing" className={shared.secondaryButton}>
                See pricing
              </Link>
            </div>
          </div>
        </section>

        <section className={styles.visualSection}>
          <div className={styles.visualFrame}>
            <Image
              src={ogImagePath}
              alt={ogImageAlt}
              fill
              priority
              className={styles.visualImage}
              sizes="(min-width: 900px) 840px, calc(100vw - 40px)"
            />
          </div>
        </section>

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <p className={shared.sectionEyebrow}>Project deadlines</p>
            <h2>Keep every project deadline visible</h2>
            <p className={shared.sectionLead}>
              Project deadlines saved in Text2Task appear in the Work
              Calendar, giving you a clear month view of upcoming client
              work. Instead of checking projects one by one, you can see
              important dates together and open any day for more context.
            </p>
          </div>

          <ul className={shared.checklist}>
            {deadlinePoints.map((point) => (
              <li key={point} className={shared.checklistItem}>
                <span className={shared.checkMark} aria-hidden="true">
                  ✓
                </span>
                {point}
              </li>
            ))}
          </ul>
        </section>

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <p className={shared.sectionEyebrow}>Manual events</p>
            <h2>Schedule the work around each deadline</h2>
            <p className={shared.sectionLead}>
              Add manual events for calls, reviews, handoffs, deliverables,
              or any client work that needs a specific date. Manual events
              live alongside project deadlines, so planning and delivery
              stay connected.
            </p>
          </div>

          <ul className={shared.checklist}>
            {manualEventPoints.map((point) => (
              <li key={point} className={shared.checklistItem}>
                <span className={shared.checkMark} aria-hidden="true">
                  ✓
                </span>
                {point}
              </li>
            ))}
          </ul>
        </section>

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <p className={shared.sectionEyebrow}>Projects and clients</p>
            <h2>Use an existing project—or enter a new name</h2>
            <p className={shared.sectionLead}>
              Link an event to an existing Text2Task project and client, or
              type a new project or client name when the work is not yet in
              your CRM. Text2Task keeps linked records and custom names
              clear and separate.
            </p>
          </div>

          <ul className={shared.checklist}>
            {linkingPoints.map((point) => (
              <li key={point} className={shared.checklistItem}>
                <span className={shared.checkMark} aria-hidden="true">
                  ✓
                </span>
                {point}
              </li>
            ))}
          </ul>
        </section>

        <section className={shared.trustSection}>
          <div className={shared.trustInner}>
            <p className={shared.sectionEyebrow}>Day-detail view</p>
            <h2>Open any day and understand what needs attention</h2>
            <p>
              Select a date to see its project deadlines and manual events
              in one focused view. Clear labels, status, priority, client
              details, notes, and direct actions help you understand the
              day without scanning the entire task list.
            </p>
          </div>
        </section>

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <p className={shared.sectionEyebrow}>Who it&rsquo;s for</p>
            <h2>Built for real client work</h2>
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
            <p className={shared.sectionEyebrow}>How it works</p>
            <h2>Plan client work in three steps</h2>
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
            <p className={shared.sectionEyebrow}>FAQ</p>
            <h2>Work Calendar questions</h2>
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
            <h2>Turn project deadlines into a clear plan</h2>
            <p>
              Keep client work, important dates, and scheduled events
              visible in one organized workspace.
            </p>
          </div>

          <div className={shared.finalActions}>
            <Link href="/signup" className={shared.primaryButtonOnDark}>
              Start free
            </Link>
            <Link href="/#pricing" className={shared.secondaryButtonOnDark}>
              See pricing
            </Link>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
