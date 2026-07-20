import type { Metadata } from "next";
import Image from "next/image";
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

const pageTitle = "How to Turn Emails Into Tasks: A Practical Workflow";
const pageDescription =
  "Learn a practical workflow for turning client emails into organized tasks, deadlines, priorities, and a reviewable project before saving.";
const pagePath = "/resources/how-to-turn-emails-into-tasks";
const pageUrl = absoluteUrl(pagePath);
const heroImagePath = "/landing/text2task-turn-emails-into-tasks-hero.png";
const ogImagePath = heroImagePath;
const ogImageUrl = absoluteUrl(ogImagePath);
const ogTitle = "How to Turn Emails Into Tasks: A Practical Workflow | Text2Task";
const ogDescription =
  "Learn how to separate project context, action items, deadlines, priorities, and supporting details from a client email before saving the work.";
const ogImageAlt =
  "An email inbox with several client messages turned into a structured task list with due dates and priorities";
const datePublished = "2026-07-16";
const dateModified = "2026-07-20";

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
    type: "article",
    images: [
      {
        url: ogImageUrl,
        width: 1448,
        height: 1086,
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

const approaches = [
  {
    title: "Create one task from the email",
    text: "This is useful when the message contains one clear action. The task can link back to the original email, but the result may still depend on the subject line and a short note.",
  },
  {
    title: "Forward or automate the email",
    text: "Forwarding rules and automations can move messages into a task system. They work well for predictable workflows, but complex client emails may still need to be separated and reviewed.",
  },
  {
    title: "Copy, structure, and review the content",
    text: "For detailed client work, copy the selected email text, separate the project context from the action items, review the dates and priorities, and save only after the structure looks right.",
  },
] as const;

const projectTasks = [
  "Update the homepage hero headline",
  "Add the new pricing section",
  "Fix the mobile menu",
  "Update the contact form",
  "Send a preview on Thursday",
] as const;

const workflowSteps = [
  {
    title: "Identify the main outcome",
    text: "Ask what the sender ultimately wants completed. Use that outcome as the project title or the main task when the request is genuinely simple.",
  },
  {
    title: "List every action item",
    text: "Separate each requested change, follow-up, approval, or delivery into a clear action. Avoid hiding several actions inside one long task description.",
  },
  {
    title: "Capture dates, urgency, amounts, and people",
    text: "Look for deadlines, relative dates, budget details, priority signals, client names, and contact information. Keep only the details that are relevant to the work.",
  },
  {
    title: "Group related tasks under the same project",
    text: "When the action items share one result or deadline, keep them together under a project instead of treating them as unrelated tasks.",
  },
  {
    title: "Review before saving",
    text: "Check the project title, tasks, dates, priorities, amounts, and client details. Remove anything that does not belong and correct unclear information before saving.",
  },
] as const;

const oneTaskWhen = [
  "The email contains one clear action",
  "There is one outcome and one owner",
  "No supporting work needs to be tracked",
  "The message context can remain attached to that task",
] as const;

const projectWhen = [
  "The email contains several related actions",
  "The work shares a deadline or budget",
  "Client and project context must stay together",
  "Progress needs to be reviewed across multiple tasks",
] as const;

const mistakes = [
  {
    title: "Using only the subject line",
    text: "The subject may describe the topic but omit the actual actions, dates, and supporting details.",
  },
  {
    title: "Saving the whole email as one task",
    text: "A long message can hide several independent actions inside one unreadable description.",
  },
  {
    title: "Losing the project context",
    text: "Tasks become harder to understand when the main request, client, budget, or shared deadline is separated from them.",
  },
  {
    title: "Ignoring relative dates",
    text: "Words such as “Friday,” “tomorrow,” or “next week” need to be checked against the date the email was received.",
  },
  {
    title: "Saving without review",
    text: "Automated extraction can reduce retyping, but the final structure still needs human confirmation.",
  },
] as const;

const relatedGuides = [
  {
    href: "/resources/turn-client-messages-into-tasks",
    title: "Turn client messages into tasks",
    text: "Use the same structured approach for client messages, notes, and screenshots.",
  },
  {
    href: "/solutions/freelancer-project-management-software",
    title: "Freelancer project management software",
    text: "See how projects, tasks, updates, history, and resources can remain connected after intake.",
  },
] as const;

const articleJsonLd = buildArticleJsonLd({
  headline: pageTitle,
  description: pageDescription,
  url: pageUrl,
  datePublished,
  dateModified,
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
      name: "How to Turn Emails Into Tasks",
      url: pageUrl,
    },
  ],
});

export default function HowToTurnEmailsIntoTasksPage() {
  return (
    <div className={styles.pageShell}>
      <JsonLd
        id="how-to-turn-emails-into-tasks-article-jsonld"
        data={articleJsonLd}
      />
      <JsonLd
        id="how-to-turn-emails-into-tasks-breadcrumb-jsonld"
        data={breadcrumbJsonLd}
      />

      <LandingHeader />

      <main>
        <article className={styles.article}>
          <Link href="/resources" className={styles.backLink}>
            &larr; Back to Resources
          </Link>

          <header className={styles.hero}>
            <p className={styles.eyebrow}>Email workflow</p>
            <h1>How to turn emails into tasks without losing project context</h1>
            <p className={styles.dateLine}>
              Published July 16, 2026 · Updated July 20, 2026
            </p>
            <p className={styles.lead}>
              A client email often contains more than one action. It may
              include the main request, several follow-up items, dates,
              urgency, budget details, and client information. A useful
              email-to-task workflow should separate the work without losing
              the context that connects it.
            </p>
          </header>

          <figure className={styles.heroFigure}>
            <Image
              src={heroImagePath}
              alt={ogImageAlt}
              width={1448}
              height={1086}
              className={styles.heroImage}
              sizes="(min-width: 820px) 820px, 100vw"
            />
            <figcaption className={styles.heroCaption}>
              Illustration: an inbox full of client emails turned into one
              structured task list.
            </figcaption>
          </figure>

          <section className={styles.section}>
            <h2>Why one email can contain an entire project</h2>
            <p>
              Email is designed for communication, not for organizing project
              work. A detailed client message can describe the outcome they
              want, the changes required, the deadline, the budget, and the
              people involved&mdash;all in one block of text.
            </p>
            <p>
              Turning the subject line into a single task may be enough for a
              simple request. But when the message contains several related
              actions, a single task hides important details and makes the
              work harder to review.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Three ways to turn an email into work</h2>
            <p>
              The right approach depends on how much structure the email
              contains and how much control you need before saving the
              result.
            </p>

            <div className={styles.approachList}>
              {approaches.map((item) => (
                <div key={item.title} className={styles.approachItem}>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={`${styles.section} ${styles.sectionWide}`}>
            <h2>Example: one client email with several action items</h2>

            <pre className={styles.emailExample}>
              <span className={styles.emailField}>
                Subject: Website launch updates before Friday
              </span>
              {"\n\n"}
              Hi Alex,
              {"\n\n"}
              Please update the homepage hero headline, add the new pricing
              section, fix the mobile menu, and update the contact form.
              {"\n\n"}
              The approved budget is $850. Please finish the changes by
              Friday and send me a preview on Thursday.
              {"\n\n"}
              Use the new logo we shared for this project.
              {"\n\n"}
              Thanks,
              {"\n"}
              Sarah
              {"\n"}
              Northline Studio
            </pre>

            <p className={styles.caption}>
              This is one email, but it describes a project, several tasks,
              two dates, a budget, a client, and an important project note.
            </p>
          </section>

          <section className={`${styles.section} ${styles.sectionWide}`}>
            <h2>From one email to a structured project</h2>
            <p>
              Instead of saving the entire email as one task, separate the
              information into fields that are easier to review and manage.
            </p>

            <dl className={styles.resultPanel}>
              <div className={styles.resultRow}>
                <dt>Project title</dt>
                <dd>Website launch updates</dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Project summary</dt>
                <dd>
                  Complete the approved homepage and mobile changes for
                  Northline Studio before Friday.
                </dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Client</dt>
                <dd>Sarah &mdash; Northline Studio</dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Budget</dt>
                <dd>$850</dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Priority</dt>
                <dd>Not specified</dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Project deadline</dt>
                <dd>Friday</dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Tasks</dt>
                <dd>
                  <ul className={styles.resultTaskList}>
                    {projectTasks.map((task) => (
                      <li key={task}>{task}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div className={styles.resultRow}>
                <dt>Project note</dt>
                <dd>Use the new logo shared for the project.</dd>
              </div>
            </dl>

            <p className={styles.caption}>
              The exact structure may vary, and every extracted detail should
              be reviewed before it is saved.
            </p>
          </section>

          <section className={styles.section}>
            <h2>A five-step email-to-task workflow</h2>

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
            <h2>When is one task enough?</h2>

            <div className={styles.decisionColumns}>
              <div className={styles.decisionColumn}>
                <h3>Use one task when</h3>
                <ul>
                  {oneTaskWhen.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className={styles.decisionColumn}>
                <h3>Use a project when</h3>
                <ul>
                  {projectWhen.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <p className={styles.caption}>
              The goal is not to create more structure than necessary. It is
              to preserve the information needed to complete the work
              correctly.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Common mistakes when converting email into tasks</h2>

            <div className={styles.mistakeList}>
              {mistakes.map((mistake) => (
                <div key={mistake.title} className={styles.mistakeItem}>
                  <h3>{mistake.title}</h3>
                  <p>{mistake.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.trustSection}>
            <h2>How Text2Task supports this workflow</h2>
            <p>
              Text2Task follows the copy, structure, and review approach. You
              paste the email text you choose to process, and the system
              prepares a reviewable project and task draft.
            </p>
            <p>
              When the information is present, the draft may include the
              project title and summary, tasks, deadlines, priorities, budget
              or amount details, and client or contact information.
            </p>
            <p>
              You can edit supported fields, remove tasks that do not belong,
              and save the approved project and tasks to your Text2Task
              workspace.
            </p>

            <p>
              See how Text2Task can{" "}
              <Link href="/features/email-to-tasks">
                turn selected email text into a reviewable project and task
                draft
              </Link>
              . Long, detail-heavy emails are common for{" "}
              <Link href="/use-cases/project-managers">
                project managers
              </Link>{" "}
              juggling requests from several stakeholders at once.
            </p>

            <p className={styles.trustNote}>
              Text2Task does not connect directly to Gmail or Outlook and
              does not monitor your inbox. Nothing is saved until you review
              and approve the draft.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Related guides</h2>

            <div className={styles.relatedList}>
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
            <div>
              <h2>Turn a detailed email into organized work</h2>
              <p>
                Paste the email text, review the project and tasks, and save
                the result when the structure looks right.
              </p>
            </div>

            <div className={styles.finalActions}>
              <Link href="/features/email-to-tasks" className={styles.primaryButton}>
                Explore Email to Tasks
              </Link>
              <Link href="/signup" className={styles.secondaryButtonOnDark}>
                Start for free
              </Link>
            </div>
          </section>
        </article>
      </main>

      <LandingFooter />
    </div>
  );
}
