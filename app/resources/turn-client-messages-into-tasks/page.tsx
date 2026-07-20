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

const articleTitle =
  "Turn Client Messages Into Tasks: A Simple Workflow for Freelancers";
const articleDescription =
  "Learn how to turn a single client message into clear tasks: separate what's explicit from what's implied, spot missing details, and review before saving.";
const articlePath = "/resources/turn-client-messages-into-tasks";
const articleUrl = absoluteUrl(articlePath);
const heroImagePath = "/landing/text2task-productivity-task-assistant-hero.png";
const heroImageUrl = absoluteUrl(heroImagePath);
const heroImageAlt =
  "One client email with key phrases highlighted, turned into a task list with deadlines and priorities";
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
            <p className={styles.eyebrow}>Client messages</p>

            <h1>{articleTitle}</h1>

            <p className={styles.dateLine}>
              Published May 7, 2026 · Updated July 20, 2026
            </p>

            <p className={styles.lead}>
              A single client message often contains more than one task —
              some stated directly, others only implied. Turning it into
              action means separating what is explicit from what is
              assumed, catching anything that is missing, and reviewing the
              result before it becomes part of your project.
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
              Illustration: one client message broken into individual tasks
              with deadlines and priorities.
            </figcaption>
          </figure>

          <section className={styles.section}>
            <h2>One message, several tasks</h2>
            <p>
              Client messages about ongoing work often read like a quick
              update, not a request. Here is a realistic shape one might
              take:
            </p>

            <blockquote className={styles.exampleBox}>
              “Hey! Loved the reel from last week. Can we push 2 more posts
              before the launch on the 14th? One should be a countdown
              story and the other a carousel showing before/after results.
              Also, let&rsquo;s repost the testimonial from Jamie since it
              did so well last time. Let me know if you need anything from
              me!”
            </blockquote>

            <p>
              Nothing here is labeled &ldquo;task 1&rdquo; or
              &ldquo;deadline.&rdquo; The requests are wrapped in friendly
              context, a compliment, and a callback to a previous post —
              which is exactly how real client messages usually read.
            </p>
          </section>

          <section className={styles.section}>
            <h2>What is explicit and what is implied</h2>
            <p>Explicit, stated directly in the message:</p>
            <ul className={styles.unorderedList}>
              <li>Two new posts before the launch on the 14th</li>
              <li>One post is a countdown story</li>
              <li>One post is a carousel with before/after results</li>
              <li>Repost the testimonial from Jamie</li>
            </ul>

            <p>Implied, but not stated outright:</p>
            <ul className={styles.unorderedList}>
              <li>The work is tied to a launch, which suggests high priority</li>
              <li>
                &ldquo;Last time&rdquo; and &ldquo;did so well&rdquo;
                reference a previous post you would need to locate
              </li>
              <li>No specific caption, hashtags, or posting time is given</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>What is missing — and what to ask</h2>
            <p>Before scheduling anything, two details are worth confirming:</p>
            <ul className={styles.unorderedList}>
              <li>
                Which month is &ldquo;the 14th&rdquo;? A relative date like
                this only makes sense next to the date the message was
                sent.
              </li>
              <li>
                Should the testimonial repost go out before or after the
                launch — and does it reuse the same caption as last time,
                or a new one?
              </li>
            </ul>
            <p>
              Saving the request with these gaps still open just moves the
              confusion downstream. A quick reply to the client, or a note
              attached to the task, keeps the ambiguity visible instead of
              guessed away.
            </p>
          </section>

          <section className={styles.section}>
            <h2>From message to structured tasks</h2>
            <p>Separated out, the same message becomes three tasks and one open question:</p>
            <ul className={styles.unorderedList}>
              <li>
                <strong>Task</strong> — Create a countdown story for the
                launch. Deadline: before the 14th (confirm month).
                Priority: High.
              </li>
              <li>
                <strong>Task</strong> — Create a before/after results
                carousel. Deadline: before the 14th (confirm month).
                Priority: High.
              </li>
              <li>
                <strong>Task</strong> — Repost Jamie&rsquo;s testimonial.
                Deadline: not specified. Priority: Medium.
              </li>
              <li>
                <strong>Open question</strong> — Confirm the month for
                &ldquo;the 14th&rdquo; and whether the repost goes before
                or after launch.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>Extract the useful fields</h2>
            <p>
              Whatever the message, the same fields make it actionable:
            </p>

            <ul className={styles.unorderedList}>
              <li>Client name</li>
              <li>Task details</li>
              <li>Deadline</li>
              <li>Budget or amount</li>
              <li>Priority</li>
              <li>Notes and context</li>
            </ul>

            <p>
              Not every message will supply every field — a social post
              request may skip budget entirely, and that is fine. The goal
              is to capture what is actually there, not to invent what is
              missing.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Review before you save</h2>
            <p>
              An extracted task list is a draft, not a finished plan —
              especially when parts of the message were implied rather
              than stated. Review each task against the original message,
              confirm anything that was assumed, and only then save it to
              your project. This matters most when a deadline is
              ambiguous, like a bare day-of-month with no stated month.
            </p>
          </section>

          <section className={styles.section}>
            <h2>How Text2Task speeds this up</h2>
            <p>
              Text2Task helps turn messy client messages and screenshots
              into organized tasks. The AI creates a structured preview,
              and you stay in control by reviewing and editing before
              saving anything. It does not guarantee that every implied
              detail is caught correctly, which is why the review step
              stays part of the workflow, not an afterthought.
            </p>
            <p>
              For a message that is mostly plain text,{" "}
              <Link href="/features/ai-task-extractor">
                explore the AI Task Extractor
              </Link>{" "}
              to see how pasted text becomes a reviewable project and task
              draft. If the message is about ongoing content work, see how
              this applies for{" "}
              <Link href="/use-cases/social-media-managers">
                social media managers
              </Link>
              .
            </p>
            <p>
              Working through a backlog of requests from several clients
              instead of one message?{" "}
              <Link href="/resources/how-to-organize-client-requests-as-a-freelancer">
                See how to organize client requests as a freelancer
              </Link>
              .
            </p>
          </section>

          <section className={styles.finalCta}>
            <div className={styles.finalCtaContent}>
              <h2>Try the workflow with your next message</h2>
              <p>
                Paste a client message — including anything that is only
                implied — and see it turned into a structured task preview
                you can review, question, and edit before saving.
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
