import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import HomepageDemoReviewClient from "./HomepageDemoReviewClient";
import styles from "./homepage-demo-review.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review your project | Text2Task",
  description: "Review the project and tasks prepared from your message.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function HomepageDemoReviewPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link
            href="/"
            prefetch={false}
            className={styles.logoLink}
            aria-label="Text2Task home"
          >
            <Image
              src="/text2task-logo.png"
              alt="Text2Task"
              width={164}
              height={44}
              priority
              className={styles.logo}
            />
          </Link>
          <div className={styles.headerCopy}>
            <p className={styles.kicker}>Temporary review</p>
            <h1 className={styles.pageTitle}>Review your project draft</h1>
            <p className={styles.pageDescription}>
              Check the project and tasks prepared from your message before creating an account.
            </p>
          </div>
        </header>

        <HomepageDemoReviewClient />
      </div>
    </main>
  );
}
