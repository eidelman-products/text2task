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

const pageTitle = "Client Project Tracker: Share Project Progress With Clients";
const pageDescription =
  "Create a link to share selected project status, tasks, and updates with a client. Choose what's visible, protect it with a PIN, and keep the rest private.";
const pagePath = "/features/client-project-tracker";
const pageUrl = absoluteUrl(pagePath);

// P1C -- the two real Client Share marketing visuals approved for this page.
// See the SEO master blueprint, Section 11 (P1C visual integration) for the
// asset-relocation and placement record.
const primaryImagePath =
  "/landing/features/client-project-tracker/client-project-tracker-share-progress-with-clients.png";
const primaryImageUrl = absoluteUrl(primaryImagePath);
const primaryImageAlt =
  "Client project tracker showing how project progress is shared with a client";

const secondaryImagePath =
  "/landing/features/client-project-tracker/client-share-project-link-management.png";
const secondaryImageAlt =
  "Text2Task Client Share controls for managing a shared project link";

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
        url: primaryImageUrl,
        width: 1672,
        height: 941,
        alt: primaryImageAlt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: [
      {
        url: primaryImageUrl,
        alt: primaryImageAlt,
      },
    ],
  },
};

const problemPoints = [
  "Copying a task list into an email or text takes time you'd rather spend on the work itself.",
  "A quick status update doesn't show what's actually done, in progress, or coming up next.",
  "Giving a client full access to your workspace shares more than they need, or than you're comfortable with.",
] as const;

const workflowSteps = [
  {
    title: "Create a share link",
    text: "Generate a project share link directly from Text2Task.",
  },
  {
    title: "Choose what's visible",
    text: "Turn on status, target date, selected tasks, resources, and updates. Only what you choose is included.",
  },
  {
    title: "Add a PIN or expiration, if you want",
    text: "Protect the link with a PIN or set it to expire automatically. Both are optional.",
  },
  {
    title: "Send the link",
    text: "Your client opens it directly. No Text2Task account is required.",
  },
] as const;

const capabilityItems = [
  "Project status and target date",
  "Selected tasks and their shared status",
  "Selected resources and files",
  "Progress updates you post yourself",
  "A PIN to protect the link",
  "An expiration date",
  "The ability to disable, re-enable, revoke, or generate a new link at any time",
] as const;

const neverSharedItems = [
  "Internal notes",
  "Priority and budget",
  "Other projects in your workspace",
  "Resources you haven't chosen to share",
] as const;

const relatedLinks = [
  {
    href: "/features/client-feedback-to-tasks",
    title: "Client Feedback to Tasks",
    text: "See how a client's reply becomes a reviewable task.",
  },
  {
    href: "/features/email-to-tasks",
    title: "Email to Tasks",
    text: "Turn a client's first message into a project before you share progress on it.",
  },
  {
    href: "/solutions/freelancer-project-management-software",
    title: "Freelancer project management software",
    text: "See the full freelancer project management workflow.",
  },
] as const;

const faqs = [
  {
    question: "Does my client need a Text2Task account to view the shared link?",
    answer:
      "No. Your client opens the link directly without a Text2Task account. If you protect the link with a PIN, they'll enter that PIN before viewing it.",
  },
  {
    question: "What can I choose to share?",
    answer:
      "You can choose to show project status, target date, selected tasks, selected resources, and updates you post yourself. Nothing is shared until you turn it on.",
  },
  {
    question: "Can I protect the link?",
    answer:
      "Yes. You can add an optional PIN and set the link to expire automatically. You can also disable, re-enable, revoke, or generate a new link at any time.",
  },
  {
    question: "Will my client see the rest of my workspace?",
    answer:
      "No. A shared link only includes the project and the fields you've explicitly turned on. Internal notes, budget, priority, other projects, and your files stay private unless you specifically choose to include a resource.",
  },
  {
    question: "Can my client leave a comment?",
    answer:
      "If you turn on comments for a link, your client can leave a message that appears in Text2Task for you to review. Nothing is added to the project automatically.",
  },
  {
    question: "Can my client edit tasks or manage the project?",
    answer:
      "No. The shared view is read-only for your client. They can view what you've shared and, if you allow it, leave a comment.",
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
  // Matches the established, post-2026-08-26-fix convention used by every
  // other Feature page: no mainEntity is declared. There is no legitimate
  // SoftwareApplication (or any other) entity for this WebPage to
  // reference, and one is not fabricated merely to fill the field.
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
      name: "Client Project Tracker",
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

export default function ClientProjectTrackerPage() {
  return (
    <div className={shared.pageShell}>
      <JsonLd id="client-project-tracker-page-jsonld" data={webPageJsonLd} />
      <JsonLd
        id="client-project-tracker-breadcrumb-jsonld"
        data={breadcrumbJsonLd}
      />
      <JsonLd id="client-project-tracker-faq-jsonld" data={faqJsonLd} />

      <LandingHeader />

      <main>
        <section className={shared.hero}>
          <div className={shared.heroInner}>
            <p className={shared.eyebrow}>Client Project Tracker</p>
            <h1>Share project status and progress with your client.</h1>
            <p className={shared.heroLead}>
              Create one link that shows exactly what you choose — selected
              tasks, updates, and status — while everything else in your
              workspace stays private.
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
              You choose what&rsquo;s visible before you send the link.
              Nothing is shared until you turn it on.
            </p>
          </div>
        </section>

        <section className={styles.primaryShowcaseSection}>
          <div className={styles.primaryShowcaseFrame}>
            <Image
              src={primaryImagePath}
              alt={primaryImageAlt}
              fill
              className={styles.primaryShowcaseImage}
              sizes="(min-width: 1180px) 1180px, calc(100vw - 40px)"
            />
          </div>
        </section>

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <p className={shared.sectionEyebrow}>Why owners need this</p>
            <h2>Clients ask for updates. Screenshots and status emails don&rsquo;t scale.</h2>
            <p className={shared.sectionLead}>
              Keeping a client in the loop usually means retyping the same
              information into an email or text every few days. That&rsquo;s
              why Text2Task gives you a simple client-facing project view
              you can share directly from a project.
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
            <h2>Create a link, choose what&rsquo;s visible, share it.</h2>
            <p className={shared.sectionLead}>
              Text2Task calls this Client Share. Turn it on for any project,
              choose what to include, and send the link.
            </p>
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
            <p className={shared.sectionEyebrow}>What you control</p>
            <h2>Choose exactly what your client can see.</h2>
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
            Nothing is included unless you turn it on.
          </p>
        </section>

        <section className={shared.section}>
          <div className={styles.secondaryDetailFrame}>
            <Image
              src={secondaryImagePath}
              alt={secondaryImageAlt}
              fill
              loading="lazy"
              className={styles.secondaryDetailImage}
              sizes="(min-width: 800px) 760px, calc(100vw - 40px)"
            />
          </div>
        </section>

        <section className={shared.trustSection}>
          <div className={shared.trustInner}>
            <p className={shared.sectionEyebrow}>Keep the rest private</p>
            <h2>Everything else in your workspace stays private.</h2>
            <p>
              A shared link is built from a fixed, limited set of fields you
              explicitly choose. The following never appear in a shared
              link, no matter what you turn on:
            </p>

            <ul className={shared.checklist}>
              {neverSharedItems.map((item) => (
                <li key={item} className={shared.checklistItem}>
                  <span className={shared.checkMark} aria-hidden="true">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <p className={shared.sectionEyebrow}>If you turn it on</p>
            <h2>Let your client leave a comment.</h2>
            <p className={shared.sectionLead}>
              You can allow comments on a shared link. If your client leaves
              a message, it appears in Text2Task so you can review it —
              nothing is added to the project until you decide to act on it.{" "}
              <Link href="/features/client-feedback-to-tasks">
                See how a client&rsquo;s reply becomes a reviewable task
                <span aria-hidden="true"> &rarr;</span>
              </Link>
            </p>
          </div>
        </section>

        <section className={shared.section}>
          <div className={shared.sectionHeader}>
            <h2>Who this helps</h2>
            <p className={shared.sectionLead}>
              Useful for freelancers, small agencies, and anyone else
              managing project work directly with a client — anywhere
              you&rsquo;d otherwise be manually copying status into an email
              or text. It fits naturally alongside Text2Task&rsquo;s{" "}
              <Link href="/solutions/freelancer-project-management-software">
                freelancer project management workflow
              </Link>
              .
            </p>
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
            <h2>Client Project Tracker questions</h2>
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
            <h2>Share the next update without writing another status email.</h2>
            <p>
              Create a link, choose what&rsquo;s visible, and send it to
              your client — all from inside Text2Task.
            </p>
          </div>

          <div className={shared.finalActions}>
            <Link href="/signup" className={shared.primaryButtonOnDark}>
              Try Text2Task free
            </Link>
            <Link
              href="/features/client-feedback-to-tasks"
              className={shared.secondaryButtonOnDark}
            >
              See Client Feedback to Tasks
            </Link>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
