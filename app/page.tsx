import type { Metadata } from "next";
import HeroSection from "./components/landing/hero-section";
import LandingFooter from "./components/landing/landing-footer";
import { absoluteUrl } from "./lib/site-config";

export const metadata: Metadata = {
  title: "Text2Task | Turn Client Messages Into Organized Work",
  description:
    "Text2Task turns messy client messages, emails, notes, and screenshots into organized work with tasks, deadlines, budgets, and client details.",

  alternates: {
    canonical: "/",
  },

  openGraph: {
    title: "Text2Task | Turn Client Messages Into Organized Work",
    description:
      "Paste a WhatsApp message, email, note, or screenshot. Text2Task extracts the project, tasks, budget, deadline, and client details.",
    url: absoluteUrl("/"),
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
      "@id": absoluteUrl("/#organization"),
      name: "Text2Task",
      url: absoluteUrl("/"),
      logo: absoluteUrl("/text2task-logo.png"),
      sameAs: [],
    },
    {
      "@type": "WebSite",
      "@id": absoluteUrl("/#website"),
      url: absoluteUrl("/"),
      name: "Text2Task",
      description:
        "Text2Task turns messy client messages, emails, notes, and screenshots into organized work.",
      publisher: {
        "@id": absoluteUrl("/#organization"),
      },
      inLanguage: "en-US",
    },
    {
      "@type": "SoftwareApplication",
      "@id": absoluteUrl("/#softwareapplication"),
      name: "Text2Task",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Productivity Software",
      operatingSystem: "Web",
      url: absoluteUrl("/"),
      description:
        "Text2Task is an AI task CRM for freelancers and service teams. It turns messy client messages into organized work with tasks, budgets, deadlines, and client details.",
      offers: {
        "@type": "Offer",
        price: "12.90",
        priceCurrency: "USD",
        availability: "https://schema.org/InStock",
        url: absoluteUrl("/signup"),
      },
      creator: {
        "@id": absoluteUrl("/#organization"),
      },
      publisher: {
        "@id": absoluteUrl("/#organization"),
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

      <LandingFooter />
    </main>
  );
}
