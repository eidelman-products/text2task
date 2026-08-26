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

// Exported for direct, non-rendering structured-data regression tests
// (app/page.test.tsx) -- HomePage's own tree includes async Server
// Components and env-dependent config, so asserting on these plain JSON-LD
// objects directly is the smallest-surface way to test them, rather than
// rendering the full page. No behavioral effect: these are the exact same
// module-level consts this file already builds and passes to <JsonLd>.
export const organizationJsonLd = {
  "@type": "Organization",
  "@id": SITE_SCHEMA_ENTITY_IDS.organization,
  name: "Text2Task",
  url: absoluteUrl("/"),
  logo: absoluteUrl("/text2task-logo.png"),
  sameAs: SITE_ORGANIZATION_SAME_AS,
} satisfies JsonLdObject;

export const websiteJsonLd = {
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

// 2026-08-26 structured-data fix -- this SoftwareApplication object was
// previously emitted here with NO `aggregateRating` and NO `review`,
// which Google/SEMrush's SoftwareApplication ("Software App") rich-result
// requirements make mandatory -- flagged as the homepage's own invalid
// item (1 of the 13 total). Text2Task does not currently have legitimate,
// PUBLICLY VISIBLE rating/review data to truthfully populate either
// field: customer story submissions do collect an optional 1-5 `rating`
// (app/api/customer-stories/submit/route.ts), but the public read path
// (lib/customer-stories/public-customer-stories.server.ts's own
// PublicCustomerStory type/SELECT) deliberately excludes it -- no rating
// is ever rendered anywhere on the site today. Fabricating an
// aggregateRating from data that is never shown to visitors would violate
// Google's own structured-data guidelines (markup must reflect visible
// page content) as well as this fix's own "no fabricated ratings/reviews"
// requirement, so the homepage intentionally stops asserting
// `SoftwareApplication` entirely rather than emitting an incomplete or
// invented one. Organization/WebSite/WebPage (all independently valid,
// not dependent on rating data) are preserved unchanged below.
// 2026-08-26 follow-up -- the several other pages (solutions/features/
// about) that held a dangling `{"@id": SITE_SCHEMA_ENTITY_IDS.softwareApplication}`
// reference (in their own WebPage's `mainEntity`, or AboutPage's `about`)
// to this now-undeclared entity have had those references removed
// (WebPage/AboutPage do not require mainEntity/about -- no replacement
// schema was added merely to fill the field). The
// SITE_SCHEMA_ENTITY_IDS.softwareApplication constant itself has been
// removed from app/lib/schema.ts, since nothing in the codebase
// references it any more. If Text2Task later launches genuine,
// publicly-displayed customer ratings, a truthful SoftwareApplication
// entity (with real aggregateRating/review) can be reintroduced, including
// a fresh `SITE_SCHEMA_ENTITY_IDS.softwareApplication` id at that time.

export const homepageWebPageJsonLd = {
  "@type": "WebPage",
  "@id": buildWebPageEntityId(absoluteUrl("/")),
  url: absoluteUrl("/"),
  name: homepageTitle,
  description: homepageDescription,
  inLanguage: "en-US",
  isPartOf: {
    "@id": SITE_SCHEMA_ENTITY_IDS.website,
  },
  publisher: {
    "@id": SITE_SCHEMA_ENTITY_IDS.organization,
  },
} satisfies JsonLdObject;

const homepageEntityGraph: readonly JsonLdObject[] = [
  organizationJsonLd,
  websiteJsonLd,
  homepageWebPageJsonLd,
];

export const structuredData = {
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
