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
import styles from "../resource-article.module.css";

const articleTitle = "How to Organize Client Requests as a Freelancer";
const articleDescription =
  "Learn how freelancers can organize client requests from WhatsApp, email, screenshots, and notes into one place, then turn each into a clear task.";
const articlePath =
  "/resources/how-to-organize-client-requests-as-a-freelancer";
const articleUrl = absoluteUrl(articlePath);
const heroImagePath = "/landing/text2task-organize-client-requests-hero.png";
const heroImageUrl = absoluteUrl(heroImagePath);
const heroImageAlt =
  "A freelancer's WhatsApp message, email, sticky note, and PDF brief organized into one prioritized list of client requests";
const datePublished = "2026-05-07";
const dateModified = "2026-07-20";

export const metadata: Metadata = {
  title: articleTitle,
  description: articleDescription,
  alternates: {
    canonical: articlePath,
  },
  openGraph: {
    title: articleTitle,
    description: articleDescription,
    url: articleUrl,
    siteName: "Text2Task",
    type: "article",
    images: [
      {
        url: heroImageUrl,
        width: 1448,
        height: 1086,
        alt: heroImageAlt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: articleTitle,
    description: articleDescription,
    images: [
      {
        url: heroImageUrl,
        alt: heroImageAlt,
      },
    ],
  },
};

export default function ArticlePage() {
  const breadcrumbJsonLd = buildBreadcrumbListJsonLd({
    currentCanonicalUrl: articleUrl,
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
        name: articleTitle,
        url: articleUrl,
      },
    ],
  });
  const articleJsonLd = buildArticleJsonLd({
    headline: articleTitle,
    description: articleDescription,
    url: articleUrl,
    datePublished,
    dateModified,
  });

  return (
    <div className={styles.pageShell}>
      <JsonLd
        id="resource-article-breadcrumb-jsonld"
        data={breadcrumbJsonLd}
      />
      <JsonLd id="resource-article-jsonld" data={articleJsonLd} />

      <LandingHeader />

      <main>
        <article className={styles.article}>
          <Link href="/resources" className={styles.backLink}>
            ← Resources
          </Link>

          <header className={styles.hero}>
            <p className={styles.eyebrow}>Freelancer workflow</p>

            <h1>{articleTitle}</h1>

            <p className={styles.dateLine}>
              Published May 7, 2026 · Updated July 20, 2026
            </p>

            <p className={styles.lead}>
              Client requests rarely arrive as one clean brief. A freelancer
              might get a WhatsApp message about a logo, an email asking for
              a quote, a sticky note about a website update, and a PDF brief
              — all in the same week, often for different clients.
              Organizing them means capturing every request in one place,
              noticing what is missing, and turning each one into a task you
              can act on.
            </p>
          </header>

          <figure className={styles.heroFigure}>
            <Image
              src={heroImagePath}
              alt={heroImageAlt}
              width={1448}
              height={1086}
              className={styles.heroImage}
              sizes="(min-width: 820px) 820px, 100vw"
            />
            <figcaption className={styles.heroCaption}>
              Illustration: incoming client requests from different
              channels organized into one place for review.
            </figcaption>
          </figure>

          <section className={styles.section}>
            <h2>Why client requests become messy</h2>
            <p>
              Nothing is wrong with the client when this happens — it is
              simply how real client communication works. Requests do not
              wait for a convenient moment or a single channel. A logo
              request lands on WhatsApp because that is where the
              conversation already was. A quote request comes by email
              because that is the professional default. A quick edit gets
              scribbled on a sticky note during a call.
            </p>

            <blockquote className={styles.exampleBox}>
              Monday: a WhatsApp message — “Hi! I need a logo for my new
              brand.” An email a few minutes later — “Can you send a quote
              for my website project?” A sticky note from Friday — “Update
              homepage banner + change CTA text.” And a two-day-old PDF
              brief with brand guidelines and project scope, still unread.
            </blockquote>

            <p>
              Four requests, three channels, and at least two different
              clients — and not one of them states a deadline. Left in
              their original inboxes and notebooks, they compete for
              attention based on whichever app happens to be open, not on
              what actually needs to happen first.
            </p>
          </section>

          <section className={styles.section}>
            <h2>What each request is missing</h2>
            <p>
              Before you can prioritize anything, check each request against
              the same short list:
            </p>

            <ul className={styles.unorderedList}>
              <li>
                <strong>Task</strong> — what is actually being asked for?
              </li>
              <li>
                <strong>Client and project</strong> — who is it for, and
                does it belong to work already in progress?
              </li>
              <li>
                <strong>Deadline</strong> — stated, implied, or missing
                entirely?
              </li>
              <li>
                <strong>Budget or priority</strong> — mentioned, or
                something to confirm later?
              </li>
              <li>
                <strong>Missing information</strong> — what would you need
                to ask before starting?
              </li>
            </ul>

            <p>
              In the example above, none of the four requests states a
              deadline. That does not mean they are all equally urgent — it
              means each one needs a quick follow-up question, or a
              reasonable default, before it gets a place in your schedule.
            </p>
          </section>

          <section className={styles.section}>
            <h2>A simple workflow for organizing requests</h2>
            <ol className={styles.orderedList}>
              <li>
                Collect the full message, screenshot, or file — not just
                the part you remember.
              </li>
              <li>
                Identify the actual task inside each request, separate from
                the pleasantries around it.
              </li>
              <li>
                Note the client, deadline, budget, and priority — or flag
                them as missing.
              </li>
              <li>
                Ask the one clarifying question that would remove the
                biggest guess.
              </li>
              <li>Save the result in one place you will actually check again.</li>
            </ol>

            <p>
              You can do this manually with a spreadsheet, Notion, Trello,
              or a CRM. The tool matters less than the habit: turning
              scattered communication into structured work before it has a
              chance to get lost. For more on separating explicit tasks
              from the context around them,{" "}
              <Link href="/resources/how-to-extract-action-items-from-text">
                see how to extract action items from text
              </Link>
              .
            </p>
          </section>

          <section className={styles.section}>
            <h2>Keep requests connected to the right project</h2>
            <p>
              A logo request and a website quote might come from the same
              client days apart, or from two unrelated ones. When a new
              request is a follow-up to something you are already tracking,
              connect it to that project instead of starting a new item — it
              keeps the history and context together instead of scattering
              it across separate to-dos.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Common mistakes when organizing client requests</h2>
            <ul className={styles.unorderedList}>
              <li>Trusting memory for a deadline that was never actually stated.</li>
              <li>
                Leaving a screenshot buried in a camera roll instead of
                turning it into a task.
              </li>
              <li>Treating every incoming message as equally urgent.</li>
              <li>
                Losing track of which request belongs to which client or
                project.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>How Text2Task helps</h2>
            <p>
              Text2Task helps freelancers turn messy client messages and
              screenshots into organized tasks. Paste a message or upload a
              screenshot, review the structured preview, edit supported
              fields, remove anything that does not belong, and save the
              approved result to your Tasks CRM. It can identify the task,
              deadline, priority, budget, and client details when they are
              present in what you provide — it does not guess at
              information that was never stated.
            </p>

            <p>
              The goal is not to replace your judgment. The goal is to save
              time at the moment work usually becomes messy: when a client
              sends a request through a channel you were not expecting.
            </p>
            <p>
              <Link href="/features/ai-task-extractor">
                See how the AI Task Extractor works
              </Link>{" "}
              to turn a pasted client request into a reviewable project and
              task draft, or read the{" "}
              <Link href="/solutions/freelancer-project-management-software">
                freelancer project management software
              </Link>{" "}
              overview to see how projects, tasks, and client updates stay
              connected after intake.
            </p>
            <p>
              Already have one specific message to work from instead of a
              backlog of requests?{" "}
              <Link href="/resources/turn-client-messages-into-tasks">
                See how to turn a single client message into tasks
              </Link>
              .
            </p>
          </section>

          <section className={styles.finalCta}>
            <div className={styles.finalCtaContent}>
              <h2>Try organizing your first client request</h2>
              <p>
                Paste one of this week&rsquo;s client messages or upload a
                screenshot, and see it turned into a structured task with
                deadline, budget, priority, and client details — reviewed
                by you before anything is saved.
              </p>
            </div>

            <Link href="/signup" className={styles.primaryButton}>
              Try Text2Task free
            </Link>
          </section>
        </article>
      </main>

      <LandingFooter />
    </div>
  );
}
