import type { Metadata } from "next";
import HeroSection from "./components/landing/hero-section";
import LandingFooter from "./components/landing/landing-footer";

const siteUrl = "https://www.text2task.com";

export const metadata: Metadata = {
  title: "Text2Task | Turn Client Messages Into Organized Work",
  description:
    "Text2Task turns messy client messages, emails, notes, and screenshots into organized work with tasks, deadlines, budgets, and client details.",

  alternates: {
    canonical: siteUrl,
  },

  openGraph: {
    title: "Text2Task | Turn Client Messages Into Organized Work",
    description:
      "Paste a WhatsApp message, email, note, or screenshot. Text2Task extracts the project, tasks, budget, deadline, and client details.",
    url: siteUrl,
    siteName: "Text2Task",
    type: "website",
    locale: "en_US",
  },

  twitter: {
    card: "summary_large_image",
    title: "Text2Task | Turn Client Messages Into Organized Work",
    description:
      "Paste a WhatsApp message, email, note, or screenshot. Text2Task extracts the project, tasks, budget, deadline, and client details.",
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
        "Text2Task turns messy client messages, emails, notes, and screenshots into organized work.",
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
        "Text2Task is an AI task CRM for freelancers and service teams. It turns messy client messages into organized work with tasks, budgets, deadlines, and client details.",
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
    <main className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />

      <HeroSection />

      <div className="mx-auto max-w-7xl px-6 pb-12 lg:px-8">
        <LandingFooter />
      </div>
    </main>
  );
}