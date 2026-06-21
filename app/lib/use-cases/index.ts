import { webDesignersUseCase } from "./cases/web-designers";
import { wordpressFreelancersUseCase } from "./cases/wordpress-freelancers";
import { webflowFreelancersUseCase } from "./cases/webflow-freelancers";
import { graphicDesignersUseCase } from "./cases/graphic-designers";
import { socialMediaManagersUseCase } from "./cases/social-media-managers";
import { videoEditorsUseCase } from "./cases/video-editors";
import { virtualAssistantsUseCase } from "./cases/virtual-assistants";
import { smallAgenciesUseCase } from "./cases/small-agencies";
import type { UseCase } from "./types";

export type {
  UseCase,
  UseCaseExampleTask,
  UseCaseFaq,
  UseCasePageData,
  UseCaseScenario,
  UseCaseScenarioFrameType,
  UseCaseV5Content,
  UseCaseV5EmailFrame,
  UseCaseV5FlowStep,
  UseCaseV5ProofImage,
} from "./types";

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

export function getUseCaseBySlug(slug: string) {
  return useCaseRegistry.find((useCase) => useCase.slug === slug);
}

export function getRelatedUseCases(slugs: string[]) {
  return slugs
    .map((slug) => getUseCaseBySlug(slug))
    .filter((useCase): useCase is UseCase => Boolean(useCase));
}

export function getUseCaseSlugs() {
  return useCaseRegistry.map((useCase) => useCase.slug);
}
