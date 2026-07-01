import type { Metadata } from "next";
import HomepageLiveDemoClient from "./components/landing/HomepageLiveDemoClient";
import HomepageDemoSection from "./components/landing/homepage-demo-section";
import HomepageCustomerStoriesSection from "./components/landing/homepage-customer-stories-section";
import HomepageFaqSection from "./components/landing/homepage-faq-section";
import HomepageFinalCtaSection from "./components/landing/homepage-final-cta-section";
import HomepageHero from "./components/landing/homepage-hero";
import HomepagePostExtractionSection from "./components/landing/homepage-post-extraction-section";
import HomepagePricingSection from "./components/landing/homepage-pricing-section";
import HomepageTrustStrip from "./components/landing/homepage-trust-strip";
import HomepageUseCasesSection from "./components/landing/homepage-use-cases-section";
import LandingFooter from "./components/landing/landing-footer";
import LandingHeader from "./components/landing/landing-header";
import { absoluteUrl } from "./lib/site-config";
import { HOMEPAGE_DEMO_CONFIG } from "@/lib/homepage-demo/config.server";

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
      sameAs: [
        "https://www.facebook.com/profile.php?id=61588954785433",
      ],
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
  const homepageDemoTurnstileSiteKey =
    process.env.HOMEPAGE_DEMO_TURNSTILE_SITE_KEY?.trim() ?? "";
  const homepageDemoLiveDemo =
    HOMEPAGE_DEMO_CONFIG.enabled && homepageDemoTurnstileSiteKey.length > 0
      ? { turnstileSiteKey: homepageDemoTurnstileSiteKey }
      : null;

  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />

      <main>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />

        <HomepageHero />
        <HomepageTrustStrip />
        {homepageDemoLiveDemo ? (
          <HomepageLiveDemoClient
            turnstileSiteKey={homepageDemoLiveDemo.turnstileSiteKey}
          />
        ) : (
          <HomepageCustomerStoriesSection />
        )}
        <HomepageDemoSection
          testimonials={
            homepageDemoLiveDemo ? <HomepageCustomerStoriesSection /> : null
          }
        />
        <HomepagePostExtractionSection />
        <HomepageUseCasesSection />
        <HomepagePricingSection />
        <HomepageFaqSection />
        <HomepageFinalCtaSection />
      </main>

      <LandingFooter />
    </div>
  );
}
