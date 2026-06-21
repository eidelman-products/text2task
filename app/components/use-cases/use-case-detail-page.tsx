import LandingFooter from "@/app/components/landing/landing-footer";
import LandingHeader from "@/app/components/landing/landing-header";
import type { UseCase } from "@/app/lib/use-cases";
import { getRelatedUseCases } from "@/app/lib/use-cases";
import UseCaseCapabilities from "./use-case-capabilities";
import UseCaseClientUpdates from "./use-case-client-updates";
import UseCaseFaq from "./use-case-faq";
import UseCaseFinalCta from "./use-case-final-cta";
import UseCaseHero from "./use-case-hero";
import UseCaseLightbox from "./use-case-lightbox";
import UseCasePainPoints from "./use-case-pain-points";
import UseCaseProof from "./use-case-proof";
import UseCaseRelated from "./use-case-related";
import UseCaseTransformation from "./use-case-transformation";
import UseCaseWorkflow from "./use-case-workflow";

type UseCaseDetailPageProps = {
  useCase: UseCase;
};

export default function UseCaseDetailPage({ useCase }: UseCaseDetailPageProps) {
  const relatedUseCases = getRelatedUseCases(useCase.relatedSlugs ?? []);

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

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: useCase.seo.title,
    description: useCase.seo.description,
    url: `https://text2task.com/use-cases/${useCase.slug}`,
    isPartOf: {
      "@type": "WebSite",
      name: "Text2Task",
      url: "https://text2task.com",
    },
    about: {
      "@type": "SoftwareApplication",
      name: "Text2Task",
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Web",
    },
  };

  return (
    <div className="min-h-screen bg-white text-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}

      <LandingHeader />

      <main>
        <UseCaseHero useCase={useCase} />
        <UseCaseTransformation useCase={useCase} />
        <UseCasePainPoints useCase={useCase} />
        <UseCaseWorkflow useCase={useCase} />
        <UseCaseCapabilities useCase={useCase} />
        <UseCaseProof useCase={useCase} />
        <UseCaseClientUpdates useCase={useCase} />
        <UseCaseFaq useCase={useCase} />
        <UseCaseRelated relatedUseCases={relatedUseCases} />
        <UseCaseFinalCta useCase={useCase} />
      </main>

      <LandingFooter />

      <UseCaseLightbox />
    </div>
  );
}
