import type { Metadata } from "next";
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
  "A practical guide for web designers who want to organize client revisions, screenshots, website edits, deadlines, and feedback faster.";
const articlePath = "/resources/manage-client-revisions-web-designers";
const articleUrl = absoluteUrl(articlePath);

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

            <p className={styles.lead}>
              Website revision requests rarely arrive in a clean format. A
              client may send a screenshot, a WhatsApp message, a list of
              edits, a deadline, and a budget note all in different places.
              The faster you organize those details, the faster you can
              deliver.
            </p>
          </header>

          <section className={styles.section}>
            <h2>The common revision problem</h2>
            <p>
              Web designers often manage homepage edits, mobile fixes, copy
              changes, pricing sections, contact form issues, and launch
              notes at the same time. When those requests stay inside chat
              threads, it is easy to miss a small but important detail.
            </p>

            <blockquote className={styles.exampleBox}>
              “Please fix the mobile menu, update the hero text, add the new
              testimonial section, use the logo from my last email, and send
              the first draft by Thursday.”
            </blockquote>

            <p>
              That message contains several tasks. It also contains a
              deadline and context. A good workflow turns it into clear
              actions before the details disappear in the conversation.
            </p>
          </section>

          <section className={styles.section}>
            <h2>A better workflow for revisions</h2>
            <ol className={styles.orderedList}>
              <li>Separate each revision into its own task.</li>
              <li>Keep the original client note for context.</li>
              <li>Extract the deadline and priority.</li>
              <li>Group work by client or project.</li>
              <li>Mark each item as new, in progress, or done.</li>
            </ol>
          </section>

          <section className={styles.section}>
            <h2>Where Text2Task fits</h2>
            <p>
              Text2Task helps web designers turn messy revision messages and
              screenshots into structured tasks. You can review the
              extracted tasks, edit the preview, and save everything into a
              clean Tasks CRM.
            </p>

            <p>
              This is especially useful for web designers, WordPress
              freelancers, Webflow freelancers, and small agencies that
              handle repeated client edits.
            </p>
          </section>

          <section className={styles.finalCta}>
            <div className={styles.finalCtaContent}>
              <h2>Turn revisions into clear tasks</h2>
              <p>
                Paste a client revision message or upload a screenshot and
                organize the work before details get lost.
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
