import type { Metadata } from "next";
import JsonLd, { type JsonLdObject } from "./components/JsonLd";
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
import HomepageWhySection from "./components/landing/homepage-why-section";
import LandingFooter from "./components/landing/landing-footer";
import LandingHeader from "./components/landing/landing-header";
import {
  SITE_SCHEMA_ENTITY_IDS,
  buildWebPageEntityId,
} from "./lib/schema";
import { SITE_ORGANIZATION_SAME_AS, absoluteUrl } from "./lib/site-config";
import { HOMEPAGE_DEMO_CONFIG } from "@/lib/homepage-demo/config.server";

const homepageTitle = "Turn Client Messages Into Projects and Tasks";
const homepageDescription =
  "Turn client messages, emails, notes, and supported screenshots into reviewable projects and tasks so client work can be organized without manually retyping every detail.";

export const metadata: Metadata = {
  title: homepageTitle,
  description: homepageDescription,

  alternates: {
    canonical: "/",
  },

  openGraph: {
    title: "Turn Client Messages Into Projects and Tasks | Text2Task",
    description:
      "Turn client messages, emails, notes, and supported screenshots into reviewable projects and tasks without manually retyping every detail.",
    url: absoluteUrl("/"),
    siteName: "Text2Task",
    type: "website",
    locale: "en_US",
  },

  twitter: {
    card: "summary_large_image",
    title: "Turn Client Messages Into Projects and Tasks | Text2Task",
    description:
      "Turn client messages, emails, notes, and supported screenshots into reviewable projects and tasks.",
  },

  robots: {
    index: true,
    follow: true,
  },
};

const organizationJsonLd = {
  "@type": "Organization",
  "@id": SITE_SCHEMA_ENTITY_IDS.organization,
  name: "Text2Task",
  url: absoluteUrl("/"),
  logo: absoluteUrl("/text2task-logo.png"),
  sameAs: SITE_ORGANIZATION_SAME_AS,
} satisfies JsonLdObject;

const websiteJsonLd = {
  "@type": "WebSite",
  "@id": SITE_SCHEMA_ENTITY_IDS.website,
  url: absoluteUrl("/"),
  name: "Text2Task",
  description:
    "Text2Task turns messy client messages, emails, notes, and screenshots into organized work.",
  publisher: {
    "@id": SITE_SCHEMA_ENTITY_IDS.organization,
  },
  inLanguage: "en-US",
} satisfies JsonLdObject;

const softwareApplicationJsonLd = {
  "@type": "SoftwareApplication",
  "@id": SITE_SCHEMA_ENTITY_IDS.softwareApplication,
  name: "Text2Task",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Productivity Software",
  operatingSystem: "Web",
  url: absoluteUrl("/"),
  isPartOf: {
    "@id": SITE_SCHEMA_ENTITY_IDS.website,
  },
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
    "@id": SITE_SCHEMA_ENTITY_IDS.organization,
  },
  publisher: {
    "@id": SITE_SCHEMA_ENTITY_IDS.organization,
  },
} satisfies JsonLdObject;

const homepageWebPageJsonLd = {
  "@type": "WebPage",
  "@id": buildWebPageEntityId(absoluteUrl("/")),
  url: absoluteUrl("/"),
  name: homepageTitle,
  description: homepageDescription,
  inLanguage: "en-US",
  isPartOf: {
    "@id": SITE_SCHEMA_ENTITY_IDS.website,
  },
  mainEntity: {
    "@id": SITE_SCHEMA_ENTITY_IDS.softwareApplication,
  },
  publisher: {
    "@id": SITE_SCHEMA_ENTITY_IDS.organization,
  },
} satisfies JsonLdObject;

const homepageEntityGraph: readonly JsonLdObject[] = [
  organizationJsonLd,
  websiteJsonLd,
  softwareApplicationJsonLd,
  homepageWebPageJsonLd,
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": homepageEntityGraph,
} satisfies JsonLdObject;

export default function HomePage() {
  const homepageDemoTurnstileSiteKey =
    process.env.HOMEPAGE_DEMO_TURNSTILE_SITE_KEY?.trim() ?? "";
  const homepageDemoLiveDemo =
    HOMEPAGE_DEMO_CONFIG.enabled && homepageDemoTurnstileSiteKey.length > 0
      ? { turnstileSiteKey: homepageDemoTurnstileSiteKey }
      : null;
  const homepageLiveDemoEnabled = homepageDemoLiveDemo !== null;

  return (
    <div className="min-h-screen bg-white">
      <LandingHeader />

      <main>
        <JsonLd id="homepage-entity-graph-jsonld" data={structuredData} />

        <HomepageHero liveDemoEnabled={homepageLiveDemoEnabled} />
        {homepageDemoLiveDemo ? (
          <HomepageLiveDemoClient
            turnstileSiteKey={homepageDemoLiveDemo.turnstileSiteKey}
          />
        ) : null}
        <HomepageTrustStrip />
        <HomepageCustomerStoriesSection />
        <HomepageDemoSection />
        <HomepageWhySection />
        <HomepagePostExtractionSection />
        <HomepageUseCasesSection />
        <HomepagePricingSection />
        <HomepageFaqSection />
        <HomepageFinalCtaSection liveDemoEnabled={homepageLiveDemoEnabled} />
      </main>

      <LandingFooter />
    </div>
  );
}
