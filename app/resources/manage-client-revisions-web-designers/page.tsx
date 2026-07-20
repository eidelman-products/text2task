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

const articleTitle = "How Web Designers Can Manage Client Revisions Faster";
const articleDescription =
  "Learn how web designers can organize client revision feedback, spot new scope early, and turn feedback into clear, reviewable tasks.";
const articlePath = "/resources/manage-client-revisions-web-designers";
const articleUrl = absoluteUrl(articlePath);
const heroImagePath = "/landing/text2task-manage-client-revisions-hero.png";
const heroImageUrl = absoluteUrl(heroImagePath);
const heroImageAlt =
  "Client feedback comments mapped to a website mockup alongside a revision workflow checklist tracking each change's status";
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
            <p className={styles.eyebrow}>Web designers</p>

            <h1>{articleTitle}</h1>

            <p className={styles.dateLine}>
              Published May 7, 2026 · Updated July 20, 2026
            </p>

            <p className={styles.lead}>
              Client revision feedback rarely arrives once. A hero headline
              note today, a photo swap and a deadline change tomorrow, then
              a marked-up screenshot a day later — each one easy to lose in
              a different inbox or chat thread. Managing revisions means
              keeping every round connected to the same project, telling a
              simple wording change apart from new scope, and reviewing
              what changed before it goes live.
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
              Illustration: client feedback linked to the page it affects,
              tracked through a revision workflow.
            </figcaption>
          </figure>

          <section className={styles.section}>
            <h2>Why revision feedback gets disorganized</h2>
            <p>
              Web designers rarely get one complete list of changes.
              Feedback shows up in rounds, spread across email, WhatsApp,
              and screenshots with circles and arrows drawn on top. Each
              round on its own is manageable. The problem is keeping all of
              them attached to the right page, the right deadline, and the
              right version of the design.
            </p>
          </section>

          <section className={styles.section}>
            <h2>One project, three rounds of feedback</h2>

            <blockquote className={styles.exampleBox}>
              Monday, email: “The hero headline needs to feel warmer — can
              you soften it? Also make the ‘Shop Now’ button more
              visible.” Wednesday, WhatsApp: “One more thing — can we swap
              the founder photo for the new one I&rsquo;m attaching, and
              push the launch to next Friday? Our copywriter needs another
              day on the About page.” Thursday: a screenshot with circles
              around the spacing between two homepage sections.
            </blockquote>

            <p>
              Three messages, two channels, and a moved deadline — for one
              homepage. Without a shared place to track them, it is easy to
              apply the headline change and miss that the launch date
              moved, or to lose the screenshot notes in a chat thread that
              has already scrolled past them.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Is it a revision or new scope?</h2>
            <p>
              Not every message from a client is a revision. Softening a
              headline and enlarging a button are refinements to work you
              already delivered, and swapping a photo is usually a revision
              too. But a request that adds a section, changes the
              site&rsquo;s structure, or introduces a new page — even if it
              arrives in the same message as a small wording fix — is new
              scope. It deserves its own conversation about time and cost
              before it becomes a task on the same list.
            </p>
          </section>

          <section className={styles.section}>
            <h2>A better workflow for revisions</h2>
            <ol className={styles.orderedList}>
              <li>
                Separate each piece of feedback into its own task, even when
                several arrive in one message.
              </li>
              <li>
                Keep the original note attached, so the reason behind the
                change is not lost.
              </li>
              <li>Flag anything that changes the deadline or looks like new scope.</li>
              <li>Link each task to the page or section it affects.</li>
              <li>Mark progress as new, in progress, in review, or done.</li>
            </ol>
          </section>

          <section className={styles.section}>
            <h2>Keeping a record of what changed</h2>
            <p>
              Revisions tend to happen in rounds, and both the client and
              future you benefit from being able to see what was requested,
              what was approved, and what is still open. A simple status
              per task — new, in progress, in review, done — plus a short
              record of what changed and when makes the next round of
              feedback faster to process, and makes it obvious when a
              client is asking for something already handled.
            </p>
          </section>

          <section className={styles.section}>
            <h2>Common mistakes when managing client revisions</h2>
            <ul className={styles.unorderedList}>
              <li>
                Applying a change from an old message after a newer one
                already replaced it.
              </li>
              <li>Missing a deadline change buried inside an unrelated request.</li>
              <li>
                Treating a new section or page as a quick revision instead
                of new scope.
              </li>
              <li>
                Losing screenshot annotations because the image was never
                turned into a task.
              </li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>Where Text2Task fits</h2>
            <p>
              Text2Task helps web designers turn messy revision messages and
              screenshots into structured tasks. You can review the
              extracted tasks, edit the preview, and save everything into a
              clean Tasks CRM. It does not decide whether something is a
              revision or new scope for you — that judgment call stays
              yours — but it keeps every round of feedback attached to the
              same project instead of scattered across separate messages.
            </p>

            <p>
              This is especially useful for web designers, WordPress
              freelancers, Webflow freelancers, and small agencies that
              handle repeated client edits. See the full{" "}
              <Link href="/use-cases/web-designers">
                web designers use case
              </Link>{" "}
              for a closer look at how revision requests turn into project
              tasks.
            </p>
            <p>
              When a revision request is a follow-up to a project that is
              already saved,{" "}
              <Link href="/features/client-feedback-to-tasks">
                explore Client Feedback to Tasks
              </Link>{" "}
              to compare the update with the existing project before
              anything changes. For the general mechanics of comparing a
              follow-up message against a saved project, see{" "}
              <Link href="/resources/how-to-turn-client-feedback-into-tasks">
                how to turn client feedback into tasks
              </Link>
              .
            </p>
          </section>

          <section className={styles.finalCta}>
            <div className={styles.finalCtaContent}>
              <h2>Turn revisions into clear tasks</h2>
              <p>
                Paste a client&rsquo;s revision message or upload a
                marked-up screenshot, and organize the work — deadline
                changes included — before details get lost between rounds.
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
