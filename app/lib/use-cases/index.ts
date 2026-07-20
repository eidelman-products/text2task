import { webDesignersUseCase } from "./cases/web-designers";
import { wordpressFreelancersUseCase } from "./cases/wordpress-freelancers";
import { webflowFreelancersUseCase } from "./cases/webflow-freelancers";
import { shopifyFreelancersUseCase } from "./cases/shopify-freelancers";
import { freelanceDevelopersUseCase } from "./cases/freelance-developers";
import { seoFreelancersUseCase } from "./cases/seo-freelancers";
import { graphicDesignersUseCase } from "./cases/graphic-designers";
import { socialMediaManagersUseCase } from "./cases/social-media-managers";
import { videoEditorsUseCase } from "./cases/video-editors";
import { projectManagersUseCase } from "./cases/project-managers";
import { virtualAssistantsUseCase } from "./cases/virtual-assistants";
import { smallAgenciesUseCase } from "./cases/small-agencies";
import type {
  UseCase,
  UseCaseCategoryMetadata,
} from "./types";

export type {
  UseCase,
  UseCaseAccentTone,
  UseCaseBoardGroup,
  UseCaseBoardItem,
  UseCaseBoardModuleData,
  UseCaseCalendarEntry,
  UseCaseCalendarModuleData,
  UseCaseCapabilities,
  UseCaseCategory,
  UseCaseCategoryMetadata,
  UseCaseChecklistModuleData,
  UseCaseClientUpdates,
  UseCaseCta,
  UseCaseFaq,
  UseCaseFaqSection,
  UseCaseFinalCta,
  UseCaseHero,
  UseCaseHeroVariant,
  UseCaseImage,
  UseCaseImageRole,
  UseCaseListing,
  UseCaseOutcomes,
  UseCasePainPoints,
  UseCasePipelineModuleData,
  UseCasePipelineRow,
  UseCaseProof,
  UseCaseRelatedLink,
  UseCaseRelatedLinksSection,
  UseCaseSectionKey,
  UseCaseSeo,
  UseCaseSignatureModule,
  UseCaseTextItem,
  UseCaseTimelineItem,
  UseCaseTimelineModuleData,
  UseCaseTransformation,
  UseCaseWorkflow,
} from "./types";

export const useCaseCategories = [
  {
    id: "website-development",
    heading: "Website & Development",
    description:
      "Turn website feedback, maintenance notes, and launch requests into clear project work.",
    order: 1,
  },
  {
    id: "creative-content",
    heading: "Creative & Content",
    description:
      "Organize revisions, production requests, approvals, and delivery details without rewriting the brief.",
    order: 2,
  },
  {
    id: "operations-teams",
    heading: "Operations & Teams",
    description:
      "Structure admin work and multi-client requests before handoff, tracking, and delivery.",
    order: 3,
  },
] as const satisfies readonly UseCaseCategoryMetadata[];

export const useCases = [
  webDesignersUseCase,
  wordpressFreelancersUseCase,
  webflowFreelancersUseCase,
  shopifyFreelancersUseCase,
  freelanceDevelopersUseCase,
  seoFreelancersUseCase,
  graphicDesignersUseCase,
  socialMediaManagersUseCase,
  videoEditorsUseCase,
  projectManagersUseCase,
  virtualAssistantsUseCase,
  smallAgenciesUseCase,
] as const satisfies readonly UseCase[];

export type UseCaseSlug = (typeof useCases)[number]["slug"];

const useCaseRegistry: readonly UseCase[] = useCases;

export function getAllUseCases() {
  return useCaseRegistry;
}

export function getUseCaseCategoryGroups() {
  return [...useCaseCategories]
    .sort((first, second) => first.order - second.order)
    .map((category) => ({
      category,
      useCases: useCaseRegistry.filter(
        (useCase) => useCase.listing.category === category.id
      ),
    }))
    .filter((group) => group.useCases.length > 0);
}

export function getUseCaseBySlug(slug: string) {
  return useCaseRegistry.find((useCase) => useCase.slug === slug);
}

export function getRelatedUseCases(slugs: readonly string[]) {
  return slugs
    .map((slug) => getUseCaseBySlug(slug))
    .filter((useCase): useCase is UseCase => Boolean(useCase));
}

export function getUseCaseSlugs() {
  return useCaseRegistry.map((useCase) => useCase.slug);
}
