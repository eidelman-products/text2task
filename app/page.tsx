import type { Metadata } from "next";
import HeroSection from "./components/landing/hero-section";

const siteUrl = "https://www.text2task.com";

export const metadata: Metadata = {
  title: "Text2Task | Turn Client Messages Into Tasks",
  description:
    "Text2Task turns messy client messages, emails, notes, and screenshots into organized tasks with deadlines, budgets, client details, phone numbers, emails, and priorities.",

  alternates: {
    canonical: siteUrl,
  },

  openGraph: {
    title: "Text2Task | Turn Client Messages Into Tasks",
    description:
      "Paste a messy client message or upload a screenshot. Text2Task extracts tasks, deadlines, budgets, client details, phone numbers, emails, and notes into one organized workspace.",
    url: siteUrl,
    siteName: "Text2Task",
    type: "website",
    locale: "en_US",
  },

  twitter: {
    card: "summary_large_image",
    title: "Text2Task | Turn Client Messages Into Tasks",
    description:
      "AI CRM for freelancers and small teams. Turn messy client messages, emails, notes, and screenshots into structured tasks in seconds.",
  },

  robots: {
    index: true,
    follow: true,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "Text2Task",
      url: siteUrl,
      logo: `${siteUrl}/favicon.ico`,
      sameAs: [],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "Text2Task",
      description:
        "Text2Task turns messy client messages, emails, notes, and screenshots into organized tasks.",
      publisher: {
        "@id": `${siteUrl}/#organization`,
      },
      inLanguage: "en-US",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#softwareapplication`,
      name: "Text2Task",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Productivity Software",
      operatingSystem: "Web",
      url: siteUrl,
      description:
        "Text2Task is an AI CRM that turns messy client messages, emails, notes, and screenshots into organized tasks with deadlines, budgets, client details, phone numbers, emails, and priorities.",
      offers: {
        "@type": "Offer",
        price: "12.90",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: `${siteUrl}/signup`,
      },
      creator: {
        "@id": `${siteUrl}/#organization`,
      },
      publisher: {
        "@id": `${siteUrl}/#organization`,
      },
    },
  ],
};

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #eef4ff 0%, #f7f9fc 42%, #f8fafc 100%)",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />

      <HeroSection />
    </main>
  );
}