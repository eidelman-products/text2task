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

const pageTitle = "Freelancer Project Management Software";
const pageDescription =
  "Freelancer project management software that turns client messages, emails, notes, and supported screenshots into reviewable projects and tasks.";
const pagePath = "/solutions/freelancer-project-management-software";
const pageUrl = absoluteUrl(pagePath);
const ogImagePath =
  "/landing/use-cases/project-managers/project-manager-stakeholder-request-project-flow.png";
const ogImageUrl = absoluteUrl(ogImagePath);
const ogTitle = "Freelancer Project Management Software | Text2Task";
const ogDescription =
  "Turn scattered client requests into reviewable projects and tasks, then manage deadlines, priorities, budgets, updates, history, and resources in one workspace.";
const ogImageAlt =
  "Client request transformed into an organized project and tasks in Text2Task";

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

const problemCards = [
  {
    title: "Scattered client details",
    text: "Requests often arrive as paragraphs, screenshots, notes, and follow-up messages instead of a clean project brief.",
  },
  {
    title: "Repetitive project setup",
    text: "Freelancers still have to pull out tasks, deadlines, priorities, budgets, and client details before the work can be tracked.",
  },
  {
    title: "Disconnected updates and resources",
    text: "Revision notes, files, links, and status changes can drift away from the project when they stay in separate conversations.",
  },
] as const;

const workflowSteps = [
  {
    title: "Paste the client context",
    text: "Paste email or message text, a note, a project brief, or upload a supported screenshot. Text2Task does not connect directly to your inbox or chat tools.",
  },
  {
    title: "Review the project and task draft",
    text: "AI organizes the incoming details into a draft with project context, tasks, deadlines, priority, budget, and client information for you to review.",
  },
  {
    title: "Save and manage the work",
    text: "Edit what needs your judgment, then save approved work into a web workspace for clients, projects, subtasks, statuses, updates, history, and resources.",
  },
] as const;

const featureCards = [
  {
    title: "Projects and subtasks",
    text: "Group client work into projects with clear subtasks instead of leaving action items inside a message thread.",
  },
  {
    title: "Deadlines and priorities",
    text: "Keep due dates and Low, Medium, or High priority visible while you decide what needs attention first.",
  },
  {
    title: "Budgets and client details",
    text: "Track budget or amount details alongside client names, contact details, notes, and project context.",
  },
  {
    title: "Statuses and project progress",
    text: "Move work through practical statuses such as New, In Progress, and Done as the project changes.",
  },
  {
    title: "Approved updates and history",
    text: "Review suggested client-update changes, apply only what you approve, and keep a history of what changed.",
  },
  {
    title: "Files, links, and notes",
    text: "Attach relevant project links, uploaded files, reference material, and internal notes to the work.",
  },
  {
    title: "Archive and restore",
    text: "Move old or completed work into the archive and restore it when you need it again.",
  },
  {
    title: "CSV export on Pro",
    text: "Export task and client data as CSV on the Pro plan when you need a portable copy.",
  },
] as const;

const comparisonRows = [
  {
    detail: "Long client email",
    manual: "Manually reread and retype tasks, budget notes, due dates, and client details into a project tool.",
    text2task:
      "Paste the email text and generate a reviewable draft that you can edit before saving.",
  },
  {
    detail: "Revision or change request",
    manual:
      "Compare the message with existing work by hand and decide which tasks or details changed.",
    text2task:
      "Review suggested updates, skip duplicates or irrelevant items, and apply only approved changes.",
  },
  {
    detail: "Project brief",
    manual:
      "Break the brief into a client record, project summary, task list, deadline, priority, and budget fields.",
    text2task:
      "Create a structured draft from the brief, then adjust fields before the project enters the workspace.",
  },
  {
    detail: "Supported screenshot",
    manual:
      "Read the screenshot, copy the visible details, and rebuild the task list one field at a time.",
    text2task:
      "Upload a supported image and review extracted tasks and project details before saving.",
  },
  {
    detail: "Follow-up project update",
    manual:
      "Search the original project, interpret the follow-up, and manually update tasks or status fields.",
    text2task:
      "Analyze the update against the saved project and approve the suggested changes you want to keep.",
  },
] as const;

const suitedFor = [
  "Web and graphic designers",
  "Freelance developers",
  "Social media managers",
  "Video editors",
  "Virtual assistants",
  "Solo project managers",
  "Other client-service freelancers and solopreneurs",
] as const;

const notReplacements = [
  "Invoicing",
  "Accounting",
  "Contracts and proposals",
  "Payment collection",
  "Time tracking",
  "Native inbox synchronization",
  "A shared client portal",
] as const;

const useCaseLinks = [
  {
    href: "/use-cases/web-designers",
    title: "Web designers",
    text: "Organize website edits, launch notes, screenshots, and revision requests before details get buried.",
  },
  {
    href: "/use-cases/project-managers",
    title: "Solo project managers",
    text: "Turn stakeholder notes and follow-ups into projects, subtasks, priorities, and deadlines.",
  },
  {
    href: "/use-cases/virtual-assistants",
    title: "Virtual assistants",
    text: "Structure admin requests, client details, and operational tasks from messages and notes.",
  },
  {
    href: "/use-cases/small-agencies",
    title: "Small agencies",
    text: "Keep multi-client requests clear before work moves into execution.",
  },
  {
    href: "/use-cases",
    title: "All use cases",
    text: "Explore more ways freelancers and service teams use Text2Task.",
  },
] as const;

const guideLinks = [
  {
    href: "/resources/how-to-organize-client-requests-as-a-freelancer",
    title: "How to Organize Client Requests as a Freelancer",
    text: "A practical workflow for turning scattered messages, screenshots, deadlines, budgets, and notes into clear work.",
  },
  {
    href: "/resources/turn-client-messages-into-tasks",
    title: "Turn Client Messages Into Tasks",
    text: "A simple guide to finding the tasks, fields, and context hidden inside client conversations.",
  },
  {
    href: "/resources/manage-client-revisions-web-designers",
    title: "Manage Client Revisions Faster",
    text: "A focused guide for web designers organizing edits, screenshots, feedback, and launch notes.",
  },
  {
    href: "/resources",
    title: "Text2Task resources",
    text: "Browse all practical guides for organizing client work.",
  },
] as const;

const featureLinks = [
  {
    href: "/features/email-to-tasks",
    title: "Email to Tasks",
    text: "Turn a client email into a reviewable project and task draft.",
  },
  {
    href: "/features/screenshot-to-tasks",
    title: "Screenshot to Tasks",
    text: "Turn a client-request screenshot into a reviewable task draft.",
  },
  {
    href: "/features/ai-task-extractor",
    title: "AI Task Extractor",
    text: "Turn pasted client text or notes into a project and task draft.",
  },
  {
    href: "/features/client-feedback-to-tasks",
    title: "Client Feedback to Tasks",
    text: "Compare follow-up client feedback with an existing saved project.",
  },
] as const;

const faqs = [
  {
    question: "What is freelancer project management software?",
    answer:
      "Freelancer project management software helps independent professionals organize client work, projects, tasks, deadlines, priorities, files, and progress in one place. Text2Task focuses on turning incoming client details into reviewable project and task drafts.",
  },
  {
    question: "How does Text2Task turn client messages into projects?",
    answer:
      "Paste a client message, email, note, project brief, or supported screenshot. Text2Task extracts structured project and task details for you to review and edit before saving.",
  },
  {
    question: "Can Text2Task create tasks from an email?",
    answer:
      "Yes. Paste the email text into Text2Task to create a reviewable project and task draft. Text2Task does not currently connect directly to Gmail or Outlook.",
  },
  {
    question: "Can I edit the AI-generated project before saving it?",
    answer:
      "Yes. Review and edit the extracted project, tasks, deadlines, priorities, budgets, and client details before saving the work.",
  },
  {
    question: "Does Text2Task include invoicing, contracts, or time tracking?",
    answer:
      "No. Text2Task is focused on organizing client requests into projects and tasks. It does not replace invoicing, contract, accounting, payment, or time-tracking tools.",
  },
  {
    question: "Can I manage work for multiple clients?",
    answer:
      "Yes. The workspace organizes client details, projects, subtasks, statuses, updates, history, and resources so separate client work stays structured.",
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
      name: pageTitle,
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

export default function FreelancerProjectManagementSoftwarePage() {
  return (
    <div className={styles.pageShell}>
      <JsonLd
        id="freelancer-project-management-page-jsonld"
        data={webPageJsonLd}
      />
      <JsonLd
        id="freelancer-project-management-breadcrumb-jsonld"
        data={breadcrumbJsonLd}
      />
      <JsonLd
        id="freelancer-project-management-faq-jsonld"
        data={faqJsonLd}
      />

      <LandingHeader />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Freelancer Project Management Software</p>
              <h1>
                Freelancer project management software that starts with the
                client message.
              </h1>
              <p className={styles.heroLead}>
                Freelancers already receive project details through messages,
                emails, notes, briefs, and screenshots. Text2Task turns those
                details into a reviewable project and task draft, so you can
                review, edit, and save organized client work instead of keeping
                another unstructured message.
              </p>

              <div className={styles.heroActions}>
                <Link href="/signup" className={styles.primaryButton}>
                  Start for free
                </Link>
                <Link href="/#demo" className={styles.secondaryButton}>
                  Try the live demo
                </Link>
              </div>

              <p className={styles.ctaNote}>
                AI-generated drafts stay reviewable before you save them.
              </p>
            </div>

            <div className={styles.heroVisual}>
              <Image
                src={ogImagePath}
                alt="A client request becoming an organized freelance project and task workflow in Text2Task"
                width={1672}
                height={941}
                priority
                className={styles.heroImage}
                sizes="(min-width: 1120px) 48vw, calc(100vw - 40px)"
              />
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>The intake problem</p>
            <h2>Project management gets messy before the project even starts.</h2>
            <p>
              A client request might arrive through an email, a message, a note,
              a brief, or a screenshot. The useful project details are often
              spread across paragraphs and follow-up messages, leaving the
              freelancer to manually rebuild the work before anything can move
              forward.
            </p>
          </div>

          <div className={styles.problemGrid}>
            {problemCards.map((card) => (
              <article key={card.title} className={styles.card}>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Message to workspace</p>
            <h2>Turn an incoming client request into organized work.</h2>
            <p>
              Text2Task supports project management for freelancers by helping
              you move from raw client context to a structured draft you can
              approve before it becomes saved work.
            </p>
          </div>

          <div className={styles.workflowGrid}>
            {workflowSteps.map((step, index) => (
              <article key={step.title} className={styles.stepCard}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>

          <div className={styles.beforeAfterGrid}>
            <figure className={styles.imageCard}>
              <Image
                src="/landing/text2task-client-gmail-request.png"
                alt="Client email containing a freelance project request before it is organized"
                width={1672}
                height={941}
                className={styles.image}
                sizes="(min-width: 960px) 44vw, calc(100vw - 40px)"
              />
              <figcaption>
                Paste the details from an email&mdash;Text2Task does not connect
                directly to your inbox.
              </figcaption>
            </figure>

            <figure className={styles.imageCard}>
              <Image
                src="/landing/text2task-ai-project-preview.png"
                alt="Text2Task project preview with extracted tasks, deadline, priority, budget, and client details"
                width={959}
                height={909}
                className={styles.image}
                sizes="(min-width: 960px) 36vw, calc(100vw - 40px)"
              />
              <figcaption>
                Review the draft, adjust the fields, and save only the work you
                approve.
              </figcaption>
            </figure>
          </div>
        </section>

        <section className={styles.splitSection}>
          <div className={styles.splitCopy}>
            <p className={styles.sectionEyebrow}>Built for client work</p>
            <h2>
              A focused task and client management workspace for freelancers.
            </h2>
            <p>
              Text2Task is a project management app for freelancers who need to
              keep client requests, tasks, and follow-ups organized after the
              first message is reviewed.
            </p>
          </div>

          <div className={styles.workspaceImageWrap}>
            <Image
              src="/landing/text2task-crm-workspace.png"
              alt="Text2Task workspace showing organized freelance clients, projects, tasks, and progress"
              width={1238}
              height={911}
              className={styles.image}
              sizes="(min-width: 960px) 46vw, calc(100vw - 40px)"
            />
          </div>

          <div className={styles.featureGrid}>
            {featureCards.map((feature) => (
              <article key={feature.title} className={styles.featureCard}>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.reviewSection}>
          <div className={styles.reviewCopy}>
            <p className={styles.sectionEyebrow}>Review before save</p>
            <h2>
              Review the AI draft before it becomes part of your workspace.
            </h2>
            <p>
              AI output in Text2Task is a draft, not an automatic final record.
              You can review and edit extracted fields before saving the work,
              which keeps your judgment in the workflow and avoids presenting
              AI as perfectly accurate.
            </p>
          </div>

          <figure className={styles.imageCard}>
            <Image
              src="/landing/text2task-client-update-review.png"
              alt="Text2Task review screen for approving client update changes before applying them"
              width={1222}
              height={577}
              className={styles.image}
              sizes="(min-width: 960px) 42vw, calc(100vw - 40px)"
            />
            <figcaption>
              Review suggested updates and apply only the changes that belong
              in the project.
            </figcaption>
          </figure>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Workflow comparison</p>
            <h2>
              Manual project setup compared with the Text2Task workflow.
            </h2>
            <p>
              Managing client tasks should reduce repetitive setup while still
              leaving room for human review. Text2Task helps create a draft, but
              you still decide what gets saved.
            </p>
          </div>

          <div className={styles.tableScroller}>
            <table className={styles.comparisonTable}>
              <thead>
                <tr>
                  <th>Incoming client detail</th>
                  <th>Manual workflow</th>
                  <th>Text2Task workflow</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.detail}>
                    <th scope="row">{row.detail}</th>
                    <td>{row.manual}</td>
                    <td>{row.text2task}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.positioningSection}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Focused positioning</p>
            <h2>
              Built for freelancers managing client work - not every part of a
              freelance business.
            </h2>
            <p>
              Text2Task is focused on freelance workflow management around
              client requests, projects, and tasks. It is not trying to replace
              the financial, legal, or time-tracking tools that many freelancers
              already use.
            </p>
          </div>

          <div className={styles.twoColumnList}>
            <article className={styles.listPanel}>
              <h3>Best suited for</h3>
              <ul>
                {suitedFor.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className={styles.listPanel}>
              <h3>Not intended to replace</h3>
              <ul>
                {notReplacements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Use cases</p>
            <h2>Use Text2Task across different freelance workflows.</h2>
            <p>
              Different client-service roles receive different kinds of
              requests. These examples show how the same reviewable workflow can
              support several freelance and solopreneur work patterns.
            </p>
          </div>

          <div className={styles.linkGrid}>
            {useCaseLinks.map((link) => (
              <Link key={link.href} href={link.href} className={styles.linkCard}>
                <span>{link.title}</span>
                <p>{link.text}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Resources</p>
            <h2>Practical guides for organizing client work.</h2>
            <p>
              Learn the habits behind better task management for freelancers:
              gather the client context, extract the useful details, and keep
              the work somewhere structured.
            </p>
          </div>

          <div className={styles.linkGrid}>
            {guideLinks.map((link) => (
              <Link key={link.href} href={link.href} className={styles.linkCard}>
                <span>{link.title}</span>
                <p>{link.text}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>Features</p>
            <h2>Explore Text2Task features</h2>
          </div>

          <div className={styles.linkGrid}>
            {featureLinks.map((link) => (
              <Link key={link.href} href={link.href} className={styles.linkCard}>
                <span>{link.title}</span>
                <p>{link.text}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.faqSection}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionEyebrow}>FAQ</p>
            <h2>Freelancer project management software FAQ</h2>
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
            <h2>Turn the next client request into an organized project.</h2>
            <p>
              Paste the request, review the draft, and save organized work with
              the project details already structured.
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
