import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import HomepageDemoReviewClient from "./HomepageDemoReviewClient";
import styles from "./homepage-demo-review.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your project is ready | Text2Task",
  description: "Save the project and tasks prepared from your message.",
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
            <p className={styles.kicker}>Temporary preview</p>
            <h1 className={styles.pageTitle}>Your project is ready</h1>
            <p className={styles.pageDescription}>
              Save this project to your free Text2Task workspace and keep
              working with its tasks, client details, deadline, budget, and
              notes.
            </p>
          </div>
        </header>

        <HomepageDemoReviewClient />
      </div>
    </main>
  );
}
