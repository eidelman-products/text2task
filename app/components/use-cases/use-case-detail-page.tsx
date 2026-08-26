import { Fragment } from "react";
import JsonLd, { type JsonLdObject } from "@/app/components/JsonLd";
import LandingFooter from "@/app/components/landing/landing-footer";
import LandingHeader from "@/app/components/landing/landing-header";
import {
  SITE_SCHEMA_ENTITY_IDS,
  buildBreadcrumbListJsonLd,
  buildWebPageEntityId,
} from "@/app/lib/schema";
import type { UseCase, UseCaseSectionKey } from "@/app/lib/use-cases";
import { getRelatedUseCases } from "@/app/lib/use-cases";
import { absoluteUrl } from "@/app/lib/site-config";
import UseCaseCapabilities from "./use-case-capabilities";
import UseCaseClientUpdates from "./use-case-client-updates";
import UseCaseFaq from "./use-case-faq";
import UseCaseFinalCta from "./use-case-final-cta";
import UseCaseHero from "./use-case-hero";
import UseCaseLightbox from "./use-case-lightbox";
import UseCasePainPoints from "./use-case-pain-points";
import UseCaseProof from "./use-case-proof";
import UseCaseRelated from "./use-case-related";
import UseCaseRelatedLinks from "./use-case-related-links";
import UseCaseSignatureModule from "./use-case-signature-module";
import UseCaseTransformation from "./use-case-transformation";
import UseCaseWorkflow from "./use-case-workflow";

type UseCaseDetailPageProps = {
  useCase: UseCase;
};

const DEFAULT_SECTION_ORDER: readonly UseCaseSectionKey[] = [
  "transformation",
  "painPoints",
  "workflow",
  "capabilities",
  "proof",
  "clientUpdates",
  "faq",
  "relatedLinks",
  "related",
  "finalCta",
];

export default function UseCaseDetailPage({ useCase }: UseCaseDetailPageProps) {
  const relatedUseCases = getRelatedUseCases(useCase.relatedSlugs ?? []);
  const canonicalUrl = absoluteUrl(`/use-cases/${useCase.slug}`);
  const visiblePageName = `${useCase.hero.title} ${useCase.hero.highlight}`;
  const sectionOrder = useCase.sectionOrder ?? DEFAULT_SECTION_ORDER;

  const faqJsonLd = useCase.faq
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: useCase.faq.items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }
    : null;

  // 2026-08-26 structured-data fix -- this WebPage previously embedded a
  // full, duplicated, incomplete `SoftwareApplication` object under
  // `about` (name/applicationCategory/operatingSystem only -- no
  // `offers`, no `aggregateRating`/`review`). Every one of the 12 Use
  // Case pages shares this exact template, so that one incomplete object
  // was independently re-declared 12 times, each one individually
  // invalid per Google/SEMrush's SoftwareApplication requirements. A Use
  // Case page is a content/landing page ABOUT the one Text2Task product
  // for a specific audience -- it is not itself a distinct software
  // listing and must not assert a `SoftwareApplication` type of its own.
  // `isPartOf`/`publisher` now reference the SAME site-wide Organization/
  // WebSite entities (declared once, on the homepage) via `@id`, matching
  // the established convention already used by
  // app/solutions/freelancer-project-management-software/page.tsx and
  // every app/features/*/page.tsx file -- not a duplicated inline object.
  // Deliberately no `mainEntity`/`about` pointing at the software product
  // entity: asserting "this landing page's main entity/subject is the
  // software application" is exactly the kind of accidental inheritance
  // that produced the original 12 invalid items, so it is intentionally
  // left out rather than replaced with a differently-shaped claim.
  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": buildWebPageEntityId(canonicalUrl),
    name: useCase.seo.title,
    description: useCase.seo.description,
    url: canonicalUrl,
    inLanguage: "en-US",
    isPartOf: {
      "@id": SITE_SCHEMA_ENTITY_IDS.website,
    },
    publisher: {
      "@id": SITE_SCHEMA_ENTITY_IDS.organization,
    },
  } satisfies JsonLdObject;

  const breadcrumbJsonLd = buildBreadcrumbListJsonLd({
    currentCanonicalUrl: canonicalUrl,
    items: [
      {
        name: "Home",
        url: absoluteUrl("/"),
      },
      {
        name: "Use Cases",
        url: absoluteUrl("/use-cases"),
      },
      {
        name: visiblePageName,
        url: canonicalUrl,
      },
    ],
  });

  const sectionRenderers: Record<UseCaseSectionKey, () => React.ReactNode> = {
    transformation: () => <UseCaseTransformation useCase={useCase} />,
    signatureModule: () => (
      <UseCaseSignatureModule useCase={useCase} field="signatureModule" />
    ),
    secondaryModule: () => (
      <UseCaseSignatureModule useCase={useCase} field="secondaryModule" />
    ),
    painPoints: () => <UseCasePainPoints useCase={useCase} />,
    workflow: () => <UseCaseWorkflow useCase={useCase} />,
    capabilities: () => <UseCaseCapabilities useCase={useCase} />,
    proof: () => <UseCaseProof useCase={useCase} />,
    clientUpdates: () => <UseCaseClientUpdates useCase={useCase} />,
    faq: () => <UseCaseFaq useCase={useCase} />,
    relatedLinks: () => <UseCaseRelatedLinks useCase={useCase} />,
    related: () => <UseCaseRelated relatedUseCases={relatedUseCases} />,
    finalCta: () => <UseCaseFinalCta useCase={useCase} />,
  };

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <JsonLd data={webPageJsonLd} />
      <JsonLd id="use-case-breadcrumb-jsonld" data={breadcrumbJsonLd} />
      {faqJsonLd ? <JsonLd data={faqJsonLd} /> : null}

      <LandingHeader />

      <main>
        <UseCaseHero useCase={useCase} />
        {sectionOrder.map((sectionKey) => (
          <Fragment key={sectionKey}>{sectionRenderers[sectionKey]()}</Fragment>
        ))}
      </main>

      <LandingFooter />

      <UseCaseLightbox />
    </div>
  );
}
