import { webDesignersUseCase } from "./cases/web-designers";
import { wordpressFreelancersUseCase } from "./cases/wordpress-freelancers";
import { webflowFreelancersUseCase } from "./cases/webflow-freelancers";
import { graphicDesignersUseCase } from "./cases/graphic-designers";
import { socialMediaManagersUseCase } from "./cases/social-media-managers";
import { videoEditorsUseCase } from "./cases/video-editors";
import { virtualAssistantsUseCase } from "./cases/virtual-assistants";
import { smallAgenciesUseCase } from "./cases/small-agencies";
import type {
  UseCase,
  UseCaseCategoryMetadata,
} from "./types";

export type {
  UseCase,
  UseCaseCapabilities,
  UseCaseCategory,
  UseCaseCategoryMetadata,
  UseCaseClientUpdates,
  UseCaseCta,
  UseCaseFaq,
  UseCaseFaqSection,
  UseCaseFinalCta,
  UseCaseHero,
  UseCaseImage,
  UseCaseImageRole,
  UseCaseListing,
  UseCaseOutcomes,
  UseCasePainPoints,
  UseCaseProof,
  UseCaseSeo,
  UseCaseTextItem,
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
  graphicDesignersUseCase,
  socialMediaManagersUseCase,
  videoEditorsUseCase,
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
